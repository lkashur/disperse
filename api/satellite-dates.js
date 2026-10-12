// api/satellite-dates.js
// Lists recent Sentinel-2 dates for a map extent, plus each scene's footprint and capture time
// so the browser can tell which scene supplied any point of a mosaic.
import { getAccessToken, MAX_CLOUD_COVER, MOSAIC_DAYS } from '../lib/copernicus.js';

const SEARCH_URL = 'https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search';
const LOOKBACK_DAYS = 90;
const MAX_SPAN_DEG = 2;   // matches api/satellite-image.js
const MAX_PAGES = 5;      // 100 scenes per page
const DAY_MS = 24 * 60 * 60 * 1000;

// ~1 m precision is plenty for footprints and keeps the response small
function roundCoords(c) { return typeof c[0] === 'number' ? c.map(v => Math.round(v * 1e5) / 1e5) : c.map(roundCoords); }

export default async function handler(req, res) {
  const bbox = String(req.query.bbox || '').split(',').map(Number);
  const [west, south, east, north] = bbox;
  if (bbox.length !== 4 || !bbox.every(Number.isFinite) || west >= east || south >= north ||
      west < -180 || east > 180 || south < -90 || north > 90) {
    return res.status(400).json({ error: 'Invalid map extent' });
  }
  if (east - west > MAX_SPAN_DEG || north - south > MAX_SPAN_DEG) {
    return res.status(400).json({ error: 'Zoom in further to view satellite imagery' });
  }

  const end = new Date();
  const listStart = new Date(end.getTime() - LOOKBACK_DAYS * DAY_MS);
  // Reach back one extra mosaic window so the oldest listed date's mosaic has its scenes too
  const searchStart = new Date(listStart.getTime() - MOSAIC_DAYS * DAY_MS);

  try {
    const token = await getAccessToken();
    const features = [];
    let next;
    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await fetch(SEARCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          bbox,
          datetime: `${searchStart.toISOString()}/${end.toISOString()}`,
          collections: ['sentinel-2-l2a'],
          limit: 100,
          ...(next != null && { next })
        })
      });
      const data = await response.json();
      if (!response.ok) {
        console.error('Catalog search failed:', JSON.stringify(data));
        return res.status(502).json({ error: 'Catalog search failed' });
      }
      features.push(...(data.features || []));
      next = data.context && data.context.next;
      if (next == null) break;
    }

    const scenes = features
      .filter(f => f.geometry && (f.properties['eo:cloud_cover'] ?? 100) <= MAX_CLOUD_COVER)
      .map(f => ({
        datetime: f.properties.datetime,
        cloudCover: Math.round(f.properties['eo:cloud_cover']),
        geometry: { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) }
      }));

    const listStartDate = listStart.toISOString().slice(0, 10);
    const dates = [...new Set(scenes.map(s => s.datetime.slice(0, 10)))]
      .filter(d => d >= listStartDate)
      .sort((a, b) => b.localeCompare(a));

    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    return res.status(200).json({ mosaicDays: MOSAIC_DAYS, dates, scenes });
  } catch (error) {
    console.error('Satellite dates error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
