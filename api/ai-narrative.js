import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const hf = createHuggingFace({
  apiKey: process.env.HF_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { osrmData, destination, startAddress } = req.body; // Added startAddress for accuracy

  const steps = osrmData?.routes?.[0]?.legs?.[0]?.steps;
  
  if (!steps || steps.length === 0) {
    return res.status(400).json({ error: "Navigation steps not found." });
  }

  // Filter: Keep meaningful steps (> 100 meters).
  const simplifiedSteps = steps
    .filter(step => step.distance > 100) 
    .map(step => ({
      instruction: step.maneuver.instruction,
      name: step.name || "the road",
      distance: `${(step.distance / 1609.34).toFixed(1)} miles`
    }));

  try {
    const { text } = await generateText({
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      prompt: `You are a professional navigation assistant. Provide a concise, one-paragraph driving summary to ${destination}.

      Rules:
      - Starting Location: Use the provided starting address "${startAddress}". If this address is clearly within a city or town, begin the summary with "From [City/Town], take...". If the address is in a rural or remote area, begin with "From [Address]".
      - Maneuvers: Use the specific maneuver provided in the route data (e.g., "Turn left", "Merge onto", "Take the exit"). Prioritize relative directions (Left/Right) but use cardinal directions (North/South) when helpful for highway or country road identification.
      - Tone: Strictly neutral and direct. No filler or conversational text.
      - Formatting: Single paragraph, max 75 words.
      
      Route Data: ${JSON.stringify(simplifiedSteps)}`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("Vercel AI SDK Error:", error);
    return res.status(500).json({ error: "Generation failed", details: error.message });
  }
}
