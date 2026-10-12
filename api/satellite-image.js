// api/satellite-image.js
// Fetches a Sentinel-2 snapshot of a map extent and streams it back as a JPEG.
import { getAccessToken } from '../lib/copernicus.js';

const MAX_SPAN_DEG = 2;   // larger extents exceed Sentinel Hub's resolution limit and waste quota
const MAX_SIZE_PX = 1024;

export default async function handler(req, res) {
  const bbox = String(req.query.bbox || '').split(',').map(Number);
  const date = String(req.query.date || '');
  const width = Math.round(Number(req.query.width));
  const height = Math.round(Number(req.query.height));

  const [west, south, east, north] = bbox;
  if (bbox.length !== 4 || !bbox.every(Number.isFinite) || west >= east || south >= north ||
      west < -180 || east > 180 || south < -90 || north > 90) {
    return res.status(400).json({ error: 'Invalid map extent' });
  }
  if (east - west > MAX_SPAN_DEG || north - south > MAX_SPAN_DEG) {
    return res.status(400).json({ error: 'Zoom in further to view satellite imagery' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date' });
  }
  if (!(width >= 1 && width <= MAX_SIZE_PX && height >= 1 && height <= MAX_SIZE_PX)) {
    return res.status(400).json({ error: 'Invalid image size' });
  }

  try {
    const token = await getAccessToken();
    // WMS 1.1.1 takes SRS (not CRS) and lon/lat axis order for EPSG:4326
    const params = new URLSearchParams({
      SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetMap',
      LAYERS: process.env.SENTINEL_LAYER_ID, STYLES: '',
      SRS: 'EPSG:4326', BBOX: bbox.join(','),
      WIDTH: String(width), HEIGHT: String(height),
      FORMAT: 'image/jpeg', TIME: `${date}/${date}`,
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
