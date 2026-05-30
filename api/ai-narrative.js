export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { osrmData, destination } = req.body;
  const HF_TOKEN = process.env.HF_TOKEN;

  if (!HF_TOKEN) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Construct the prompt using the OSRM data passed from your frontend
    const prompt = `
      You are a helpful trail guide. Summarize these navigation instructions for a trip to ${destination}. 
      Make it a concise, helpful narrative summary that is easy for a human to follow.
      
      Routing Data: ${JSON.stringify(osrmData)}
    `;

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

    const result = await response.json();
    
    // Return the AI's generated text back to your frontend
    res.status(200).json(result);
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate narrative' });
  }
}
