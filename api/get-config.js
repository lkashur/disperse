// api/get-config.js
export default async function handler(req, res) {
  res.status(200).json({
    mapTilerKey: process.env.MAPTILER_KEY,
    sentinelInstanceId: process.env.SENTINEL_INSTANCE_ID,
    sentinelLayerId: process.env.SENTINEL_LAYER_ID
  });
}
