export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { osrmData, destination } = req.body;
  const HF_TOKEN = process.env.HF_TOKEN;

  // 2. Debug: Check if token is loaded
  console.log("Environment check - Token exists:", !!HF_TOKEN);
  if (HF_TOKEN) {
    console.log("Token prefix:", HF_TOKEN.substring(0, 4));
  }

  if (!HF_TOKEN) {
    return res.status(500).json({ error: 'Server configuration error: HF_TOKEN missing' });
  }

  try {
    const prompt = `
      You are a helpful trail guide. Summarize these navigation instructions for a trip to ${destination}. 
      Make it a concise, helpful narrative summary that is easy for a human to follow.
      
      Routing Data: ${JSON.stringify(osrmData)}
    `;

    // 3. Perform the API call
    const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${HF_TOKEN}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        inputs: `[INST] ${prompt} [/INST]`,
        parameters: { max_new_tokens: 500 }
      })
    });

    const data = await response.json();

    // 4. Debug: Log the response status and data
    console.log("Hugging Face Response Status:", response.status);
    console.log("Hugging Face Data:", JSON.stringify(data));

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: 'Hugging Face API error', 
        details: data 
      });
    }

    // 5. Success
    res.status(200).json(data);
    
  } catch (error) {
    console.error("API Catch Block Error:", error);
    res.status(500).json({ error: 'Failed to generate narrative', message: error.message });
  }
}
