export default async function handler(req, res) {
  try {
    // We are testing if Vercel can reach ANY public site
    const response = await fetch('https://www.google.com');
    return res.status(200).json({ status: "Success", code: response.status });
  } catch (err) {
    return res.status(500).json({ error: "Network unreachable", details: err.message });
  }
}
