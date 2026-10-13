// api/satellite-dates.js
// Lists Sentinel-2 acquisition dates over a point for the current and previous five calendar
// months, with each day's cloud cover. The browser filters by cloud cover itself.
import { getAccessToken } from '../lib/copernicus.js';

const SEARCH_URL = 'https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search';
const MONTHS = 6;
const MAX_PAGES = 5;          // 100 scenes per page
const POINT_RADIUS_DEG = 0.001;

export default async function handler(req, res) {
  const lng = Number(req.query.lng);
  const lat = Number(req.query.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1), 1));

  try {
    const token = await getAccessToken();
    const features = [];
    let next;
    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await fetch(SEARCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          bbox: [lng - POINT_RADIUS_DEG, lat - POINT_RADIUS_DEG, lng + POINT_RADIUS_DEG, lat + POINT_RADIUS_DEG],
          datetime: `${start.toISOString()}/${now.toISOString()}`,
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

    // Overlapping tiles of one pass give several scenes per day; keep the clearest
    const cloudByDate = new Map();
    for (const f of features) {
      const date = f.properties.datetime.slice(0, 10);
      const cloud = f.properties['eo:cloud_cover'] ?? 100;
      if (!cloudByDate.has(date) || cloud < cloudByDate.get(date)) cloudByDate.set(date, cloud);
    }
    const dates = [...cloudByDate]
      .map(([date, cloud]) => ({ date, cloudCover: Math.round(cloud) }))
      .sort((a, b) => b.date.localeCompare(a.date));

    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    return res.status(200).json({ start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10), dates });
  } catch (error) {
    console.error('Satellite dates error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
