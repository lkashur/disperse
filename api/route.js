// api/route.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  const { start, end } = req.body;

  // IMPORTANT: The /geojson suffix is required for your index.html render logic
  const url = `https://api.openrouteservice.org/v2/directions/driving-car/geojson`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': process.env.ORS_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ coordinates: [start, end] })
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: "Routing service unreachable" });
  }
}
