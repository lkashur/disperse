// api/get-token.js
export default async function handler(req, res) {
  try {
    const response = await fetch('https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.SENTINEL_CLIENT_ID,
        client_secret: process.env.SENTINEL_CLIENT_SECRET,
        grant_type: 'client_credentials'
      })
    });

    const data = await response.json();
    
    // Check if Copernicus returned an error
    if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch token' });
    }

    // Return ONLY the access token to the client
    res.status(200).json({ access_token: data.access_token });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
