import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const hf = createHuggingFace({
  apiKey: process.env.HF_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { osrmData, destination } = req.body;

  try {
    const { text } = await generateText({
      model: hf('mistralai/Mistral-7B-Instruct-v0.3'),
      prompt: `[INST] Summarize these navigation instructions for ${destination}: ${JSON.stringify(osrmData)} [/INST]`,
    });

    return res.status(200).json({ generated_text: text });
  } catch (error) {
    console.error("Vercel AI SDK Error:", error);
    return res.status(500).json({ error: "Generation failed" });
  }
}
