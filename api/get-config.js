// api/get-config.js
export default async function handler(req, res) {
  res.status(200).json({
    mapTilerKey: process.env.MAPTILER_KEY
  });
}
