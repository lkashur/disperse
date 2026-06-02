// api/route.js
export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    try {
        const { start, end } = req.body;
        const apiKey = process.env.ORS_KEY; 

        if (!apiKey) {
            return res.status(500).json({ error: "Server Configuration Error: ORS_KEY missing" });
        }

        const response = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${start[0]},${start[1]}&end=${end[0]},${end[1]}`);
        
        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: "ORS API Failure", details: data });
        }

        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
}
