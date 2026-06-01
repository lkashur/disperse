export default async function handler(req, res) {
  const { q } = req.query;
  const key = process.env.MAPTILER_KEY;
  
  if (!key) {
    return res.status(500).json({ error: "Missing API Key" });
  }

  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${key}`;
  
  try {
    const response = await fetch(url);
    const text = await response.text(); // Get raw text first

    if (!response.ok) {
        // If the API call failed, DO NOT try to parse as JSON.
        // Just send back the raw error message so you can see what went wrong.
        console.error("MapTiler API returned error:", text);
        return res.status(response.status).json({ error: "MapTiler API Error", details: text });
    }

    // Only parse if we know the response was successful (200 OK)
    const data = JSON.parse(text);
    res.status(200).json(data);
    
  } catch (e) {
    // This catches the JSON.parse error if things go wrong
    console.error("Function crashed:", e);
    res.status(500).json({ error: "Server error", message: e.message });
  }
}
