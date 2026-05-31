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

  // PRUNING: We filter for steps > 0.5 miles (approx 800m). 
  // This helps remove "local neighborhood" turns before the AI even sees them.
  const simplifiedSteps = steps
    .filter(step => step.distance > 800) 
    .map(step => ({
      maneuver: step.maneuver.type, // We now pass the maneuver type
      instruction: step.maneuver.instruction,
      name: step.name || "the road",
      distance: `${(step.distance / 1609.34).toFixed(1)} miles`
    }));

  try {
    const { text } = await generateText({
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      prompt: `You are a professional navigation assistant. Create a summarized driving itinerary to ${destination}.

      Rules:
      1. Extraction: Analyze "${startAddress}". If a city or town is found, begin with "From [City], take...". Do not include street addresses.
      2. Filtering: Ignore all neighborhood or residential street names. Start the directions at the first major arterial road or highway.
      3. Clarity: Use clear directional commands like "Turn left," "Turn right," "Merge," "Take the exit," or "Keep straight." Do not just list road names.
      4. Format: A single, flowing paragraph. No numbered lists.
      5. Length: Max 75 words.
      
      Route Data: ${JSON.stringify(simplifiedSteps)}`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("Vercel AI SDK Error:", error);
    return res.status(500).json({ error: "Generation failed", details: error.message });
  }
}
