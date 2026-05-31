import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const hf = createHuggingFace({
  apiKey: process.env.HF_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { osrmData, destination, startAddress } = req.body;

  const steps = osrmData?.routes?.[0]?.legs?.[0]?.steps;
  
  if (!steps || steps.length === 0) {
    return res.status(400).json({ error: "Navigation steps not found." });
  }

  // Filter: Keep meaningful steps (> 200 meters) to avoid local "noise"
  const simplifiedSteps = steps
    .filter(step => step.distance > 200) 
    .map(step => ({
      instruction: step.maneuver.instruction,
      name: step.name || "the road",
      distance: `${(step.distance / 1609.34).toFixed(1)} miles`
    }));

  try {
    const { text } = await generateText({
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      prompt: `You are a professional navigation assistant. Write a concise driving itinerary to ${destination} using ONLY the provided route data.

      Strict Rules:
      - Start: Begin with "From [City/Town], take..." based on "${startAddress}". If no city is clear, use "From the starting location, take...". DO NOT mention the specific street name.
      - Integrity: Use the exact maneuvers (Turn, Merge, Exit) from the data provided. Do not invent connections between roads.
      - Conciseness: Skip minor streets. Focus only on major transitions and highway changes.
      - Tone: Neutral and direct. 
      - Limit: Max 60 words.
      
      Route Data: ${JSON.stringify(simplifiedSteps)}`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("Vercel AI SDK Error:", error);
    return res.status(500).json({ error: "Generation failed", details: error.message });
  }
}
