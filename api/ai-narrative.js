import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const hf = createHuggingFace({
  apiKey: process.env.HF_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { osrmData, destination } = req.body;

  // 1. IMPROVED VALIDATION: Check for structure before crashing
  if (!osrmData || !osrmData.routes || !Array.isArray(osrmData.routes) || osrmData.routes.length === 0) {
    console.error("ERROR: osrmData does not contain a 'routes' array.");
    console.error("Received data snippet:", JSON.stringify(osrmData).substring(0, 200));
    return res.status(400).json({ 
        error: "Invalid OSRM data. The backend received coordinates but no route data.",
        received: osrmData 
    });
  }

  try {
    // 2. Safely access the data
    const steps = osrmData.routes[0].legs[0].steps;
    
    const simplifiedSteps = steps.map(step => ({
      instruction: step.maneuver.instruction,
      distance: step.distance
    }));

    const { text } = await generateText({
      model: hf('mistralai/Mistral-7B-Instruct-v0.3'),
      prompt: `[INST] Summarize these navigation instructions for ${destination}: ${JSON.stringify(simplifiedSteps)} [/INST]`,
    });

    return res.status(200).json({ generated_text: text });

  } catch (error) {
    console.error("Generation Error:", error);
    return res.status(500).json({ error: "Generation failed" });
  }
}
