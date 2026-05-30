import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

// Initialize the provider with your token
const hf = createHuggingFace({
  apiKey: process.env.HF_TOKEN,
});

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { osrmData, destination } = req.body;

    // Safety check: ensure OSRM data is valid
    if (!osrmData?.routes?.[0]?.legs?.[0]?.steps) {
      return res.status(400).json({ error: "Invalid OSRM data structure" });
    }

    // MINIFICATION: Strip the heavy coordinate geometry/polylines.
    // We keep only the instruction and distance to reduce the payload size.
    const simplifiedSteps = osrmData.routes[0].legs[0].steps.map(step => ({
      instruction: step.maneuver.instruction,
      distance: step.distance
    }));

    // Generate the narrative
    const { text } = await generateText({
      model: hf('mistralai/Mistral-7B-Instruct-v0.3'),
      prompt: `[INST] Summarize these navigation instructions for ${destination}: ${JSON.stringify(simplifiedSteps)} [/INST]`,
    });

    return res.status(200).json({ generated_text: text });

  } catch (error) {
    console.error("Vercel AI SDK Error:", error);
    
    return res.status(500).json({ 
      error: "Generation failed", 
      details: error.message 
    });
  }
}
