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

  // Filter: Keep significant steps (long distance or major junctions)
  // This helps remove tiny local residential segments automatically
  const simplifiedSteps = steps
    .filter(step => step.distance > 500 || step.maneuver.type.includes('turn') || step.maneuver.type.includes('exit'))
    .map(step => ({
      instruction: step.maneuver.instruction,
      name: step.name || "the road",
      distance: `${(step.distance / 1609.34).toFixed(1)} miles`
    }));

  try {
    const { text } = await generateText({
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      prompt: `You are a professional navigation assistant. Create a driving itinerary to ${destination}.

      Rules:
      1. Start: Identify the city or town from "${startAddress}". Begin the sentence with "From [City/Town], take...". If no city/town is clear, use "From the starting location, take...".
      2. Pruning: The provided route data includes local residential streets. IGNORE these initial neighborhood turns. Start your itinerary at the first major arterial road, highway, or interstate transition.
      3. Sequence: List major highway transitions, exits, and turns in order. DO NOT skip sections of the trip.
      4. Terminology: Use "Turn", "Merge", or "Take the exit".
      5. Length: Max 75 words.
      
      Route Data: ${JSON.stringify(simplifiedSteps)}`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("Vercel AI SDK Error:", error);
    return res.status(500).json({ error: "Generation failed", details: error.message });
  }
}
