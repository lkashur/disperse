import dns from 'dns';
// Force the function to use Google DNS to bypass internal resolution issues
dns.setServers(['8.8.8.8']);

import { HfInference } from '@huggingface/inference';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { osrmData, destination } = req.body;
    
    // Initialize the SDK with your environment variable
    const hf = new HfInference(process.env.HF_TOKEN);

    // Call the model
    const result = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.3',
      inputs: `[INST] Summarize these navigation instructions for ${destination}: ${JSON.stringify(osrmData)} [/INST]`,
      parameters: {
        max_new_tokens: 500,
        temperature: 0.7
      }
    });

    // Return the clean result
    return res.status(200).json({ generated_text: result.generated_text });

  } catch (err) {
    console.error("SDK Error details:", err);
    return res.status(500).json({ 
      error: "AI Generation failed", 
      details: err.message,
      code: err.code || "UNKNOWN_ERROR" 
    });
  }
}
