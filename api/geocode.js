// api/geocode.js
export default async function handler(req, res) {
  const { q } = req.query;
  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${process.env.MAPTILER_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  res.status(200).json(data);
}
