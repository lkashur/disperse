// api/route.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }
  
  const { start, end } = req.body;
  const url = `https://api.openrouteservice.org/v2/directions/driving-car`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': process.env.ORS_KEY, // Make sure this env var is set in Vercel
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ coordinates: [start, end] })
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    console.error("Routing Proxy Error:", e);
    res.status(500).json({ error: "Routing service unreachable" });
  }
}
