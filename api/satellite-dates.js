// api/satellite-dates.js
// Lists recent, mostly clear Sentinel-2 dates around a point.
import { getAccessToken } from '../lib/copernicus.js';

const SEARCH_URL = 'https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search';
const LOOKBACK_DAYS = 90;
const MAX_CLOUD_COVER = 40;
const SEARCH_RADIUS_DEG = 0.1;

export default async function handler(req, res) {
  const lng = Number(req.query.lng);
  const lat = Number(req.query.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  const end = new Date();
  const start = new Date(end.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  try {
    const token = await getAccessToken();
    const response = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        bbox: [lng - SEARCH_RADIUS_DEG, lat - SEARCH_RADIUS_DEG, lng + SEARCH_RADIUS_DEG, lat + SEARCH_RADIUS_DEG],
        datetime: `${start.toISOString()}/${end.toISOString()}`,
        collections: ['sentinel-2-l2a'],
        limit: 100
      })
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Catalog search failed:', JSON.stringify(data));
      return res.status(502).json({ error: 'Catalog search failed' });
    }

    // One entry per day, keeping the clearest scene of that day
    const cloudByDate = new Map();
    for (const f of data.features || []) {
      const date = f.properties.datetime.split('T')[0];
      const cloud = f.properties['eo:cloud_cover'] ?? 100;
      if (cloud > MAX_CLOUD_COVER) continue;
      if (!cloudByDate.has(date) || cloud < cloudByDate.get(date)) cloudByDate.set(date, cloud);
    }
    const dates = [...cloudByDate]
      .map(([date, cloud]) => ({ date, cloudCover: Math.round(cloud) }))
      .sort((a, b) => b.date.localeCompare(a.date));

    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    return res.status(200).json({ dates });
  } catch (error) {
    console.error('Satellite dates error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
