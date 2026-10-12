// api/satellite-image.js
// Fetches a Sentinel-2 mosaic of a map extent and streams it back as a JPEG.
// Each pixel comes from the newest scene in the MOSAIC_DAYS window ending on `date`
// that covers it, so gaps at a pass's edge are filled from earlier passes.
// The extent arrives as lon/lat; the image is rendered in Web Mercator to match the map.
import { getAccessToken, MAX_CLOUD_COVER, MOSAIC_DAYS } from '../lib/copernicus.js';

const MAX_SPAN_DEG = 2;   // larger extents exceed Sentinel Hub's resolution limit and waste quota
const MAX_SIZE_PX = 1024;
const MAX_LAT = 85;       // Web Mercator is undefined at the poles
const HALF_CIRCUMFERENCE_M = 20037508.342789244;
const DAY_MS = 24 * 60 * 60 * 1000;

function toWebMercator(lng, lat) {
  const x = lng * HALF_CIRCUMFERENCE_M / 180;
  const y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) * HALF_CIRCUMFERENCE_M / Math.PI;
  return [x, y];
}

export default async function handler(req, res) {
  const bbox = String(req.query.bbox || '').split(',').map(Number);
  const date = String(req.query.date || '');
  const width = Math.round(Number(req.query.width));
  const height = Math.round(Number(req.query.height));

  const [west, south, east, north] = bbox;
  if (bbox.length !== 4 || !bbox.every(Number.isFinite) || west >= east || south >= north ||
      west < -180 || east > 180 || south < -MAX_LAT || north > MAX_LAT) {
    return res.status(400).json({ error: 'Invalid map extent' });
  }
  if (east - west > MAX_SPAN_DEG || north - south > MAX_SPAN_DEG) {
    return res.status(400).json({ error: 'Zoom in further to view satellite imagery' });
  }
  const endMs = Date.parse(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(endMs)) {
    return res.status(400).json({ error: 'Invalid date' });
  }
  if (!(width >= 1 && width <= MAX_SIZE_PX && height >= 1 && height <= MAX_SIZE_PX)) {
    return res.status(400).json({ error: 'Invalid image size' });
  }

  try {
    const token = await getAccessToken();
    const [minX, minY] = toWebMercator(west, south);
    const [maxX, maxY] = toWebMercator(east, north);
    // Same inclusive day window the browser uses to work out each pixel's capture date
    const startDate = new Date(endMs - MOSAIC_DAYS * DAY_MS).toISOString().slice(0, 10);
    // WMS 1.1.1 takes SRS (not CRS). MAXCC overrides the layer's own cloud limit so it matches the date search.
    const params = new URLSearchParams({
      SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetMap',
      LAYERS: process.env.SENTINEL_LAYER_ID, STYLES: '',
      SRS: 'EPSG:3857', BBOX: [minX, minY, maxX, maxY].join(','),
      WIDTH: String(width), HEIGHT: String(height),
      FORMAT: 'image/jpeg', TIME: `${startDate}/${date}`,
      MAXCC: String(MAX_CLOUD_COVER), PRIORITY: 'mostRecent',
      access_token: token
    });
    const response = await fetch(`https://sh.dataspace.copernicus.eu/ogc/wms/${process.env.SENTINEL_INSTANCE_ID}?${params}`);

    // WMS errors can come back as XML with a 200 status, so check the content type too
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.startsWith('image/')) {
      console.error('WMS request failed:', response.status, await response.text());
      return res.status(502).json({ error: 'Imagery request failed' });
    }

    res.setHeader('Content-Type', contentType);
    // Past imagery never changes, so let Vercel's CDN serve repeat requests
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.status(200).send(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error('Satellite image error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
