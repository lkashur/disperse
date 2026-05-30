import { HfInference } from '@huggingface/inference';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { osrmData, destination } = req.body;
  const HF_TOKEN = process.env.HF_TOKEN;

  if (!HF_TOKEN) {
    return res.status(500).json({ error: 'Server configuration error: HF_TOKEN missing' });
  }

  try {
    const hf = new HfInference(HF_TOKEN);
    const prompt = `You are a helpful trail guide. Summarize these navigation instructions for a trip to ${destination}. Data: ${JSON.stringify(osrmData)}`;

    const response = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.3',
      inputs: `[INST] ${prompt} [/INST]`,
      parameters: { max_new_tokens: 500 }
    });

    res.status(200).json(response);
  } catch (error) {
    console.error("SDK Error:", error);
    res.status(500).json({ error: 'Failed to generate narrative', details: error.message });
  }
}
