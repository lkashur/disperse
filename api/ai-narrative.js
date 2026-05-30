// /api/ai-narrative.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { inputs } = req.body;
  // This token is kept safe on your server, not in the browser
  const HF_TOKEN = process.env.HF_TOKEN; 

  const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${HF_TOKEN}`, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({
      inputs: `[INST] Summarize this route into a 3-sentence guide: ${inputs}. Focus on highway changes and entering the forest road. [/INST]`,
      parameters: { max_new_tokens: 150 }
    })
  });

  const data = await response.json();
  res.status(200).json(data);
}
