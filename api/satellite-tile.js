// api/satellite-tile.js
// Serves one natural-colour Sentinel-2 map tile for a single acquisition date.
// Areas the day's passes didn't cover are transparent so the basemap shows through.
import { getAccessToken } from '../lib/copernicus.js';

const MIN_ZOOM = 8;    // wider tiles exceed Sentinel Hub's resolution limit
const MAX_ZOOM = 14;   // beyond Sentinel-2's 10 m pixels; the map scales tiles up past this
const TILE_PX = 512;
const HALF_CIRCUMFERENCE_M = 20037508.342789244;

// Natural colour with the scene's data mask as alpha, independent of the layer's own styling
const EVALSCRIPT = Buffer.from(`//VERSION=3
function setup() {
  return { input: ["B04", "B03", "B02", "dataMask"], output: { bands: 4 } };
}
function evaluatePixel(s) {
  return [2.5 * s.B04, 2.5 * s.B03, 2.5 * s.B02, s.dataMask];
}`).toString('base64');

function isInt(v, min, max) { return Number.isInteger(v) && v >= min && v <= max; }

export default async function handler(req, res) {
  const z = Number(req.query.z), x = Number(req.query.x), y = Number(req.query.y);
  const date = String(req.query.date || '');
  if (!isInt(z, MIN_ZOOM, MAX_ZOOM) || !isInt(x, 0, 2 ** z - 1) || !isInt(y, 0, 2 ** z - 1)) {
    return res.status(400).json({ error: 'Invalid tile' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return res.status(400).json({ error: 'Invalid date' });
  }

  // Web Mercator bounds of the tile, so it lines up exactly with the map
  const size = 2 * HALF_CIRCUMFERENCE_M / 2 ** z;
  const minX = -HALF_CIRCUMFERENCE_M + x * size;
  const maxY = HALF_CIRCUMFERENCE_M - y * size;

  try {
    const token = await getAccessToken();
    // WMS 1.1.1 takes SRS (not CRS). MAXCC=100 because the user picked this date knowing its cloud cover.
    const params = new URLSearchParams({
      SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetMap',
      LAYERS: process.env.SENTINEL_LAYER_ID, STYLES: '',
      SRS: 'EPSG:3857', BBOX: [minX, maxY - size, minX + size, maxY].join(','),
      WIDTH: String(TILE_PX), HEIGHT: String(TILE_PX),
      FORMAT: 'image/png', TRANSPARENT: 'true',
      TIME: `${date}/${date}`, MAXCC: '100', PRIORITY: 'mostRecent',
      EVALSCRIPT,
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
    // A past day's imagery never changes, so let Vercel's CDN share tiles across users
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    return res.status(200).send(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error('Satellite tile error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
