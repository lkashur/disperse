import https from 'https';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { osrmData, destination } = req.body;
  const postData = JSON.stringify({
    inputs: `[INST] Summarize these navigation instructions for ${destination}: ${JSON.stringify(osrmData)} [/INST]`
  });

  const options = {
    hostname: 'api-inference.huggingface.co',
    path: '/models/mistralai/Mistral-7B-Instruct-v0.3',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HF_TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'Vercel-Function/1.0' // Crucial for HF compliance
    }
  };

  return new Promise((resolve) => {
    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        // Return whatever the API sent back (even if it's an error)
        res.status(response.statusCode).json({ status: response.statusCode, body: data });
        resolve();
      });
    });

    request.on('error', (e) => {
      console.error("HTTPS Request Error:", e);
      res.status(500).json({ error: "Native HTTPS request failed", details: e.message });
      resolve();
    });

    request.write(postData);
    request.end();
  });
}
