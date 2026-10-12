// lib/copernicus.js
// Server-side Copernicus auth; the access token never leaves the serverless functions.
const TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';

// Reused across invocations while the function instance stays warm
let cachedToken = null;
let cachedExpiry = 0;

export async function getAccessToken() {
  if (cachedToken && Date.now() < cachedExpiry) return cachedToken;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.SENTINEL_CLIENT_ID,
      client_secret: process.env.SENTINEL_CLIENT_SECRET,
      grant_type: 'client_credentials'
    })
  });
  if (!response.ok) throw new Error(`Copernicus token request failed: HTTP ${response.status}`);

  const data = await response.json();
  cachedToken = data.access_token;
  // Refresh a minute early so a token never expires mid-request
  cachedExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}
