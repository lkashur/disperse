import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const hf = createHuggingFace({
  apiKey: process.env.HF_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { osrmData, destination } = req.body;

  if (!osrmData?.routes?.[0]?.legs?.[0]?.steps) {
    return res.status(400).json({ error: "Invalid OSRM data" });
  }

  const simplifiedSteps = osrmData.routes[0].legs[0].steps.map(step => ({
    instruction: step.maneuver.instruction,
    distance: step.distance
  }));

  try {
    const { text } = await generateText({
      // 1. UPDATED MODEL: Switching to a verified Chat model
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      // 2. UPDATED PROMPT: Llama 3 handles prompt text natively without [INST] tags
      prompt: `Summarize these navigation instructions for ${destination}: ${JSON.stringify(simplifiedSteps)}`,
    });

    return res.status(200).json({ generated_text: text });
  } catch (error) {
    console.error("Vercel AI SDK Error:", error);
    return res.status(500).json({ error: "Generation failed", details: error.message });
  }
}
