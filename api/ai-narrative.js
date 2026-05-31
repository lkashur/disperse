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

  // Aggressive Filtering: Keep only major transitions ( > 1 mile)
  const simplifiedSteps = steps
    .filter(step => step.distance > 1609 || step.maneuver.type.includes('new name')) 
    .map(step => ({
      instruction: step.maneuver.instruction,
      name: step.name || "the road",
      distance: `${(step.distance / 1609.34).toFixed(1)} miles`
    }));

  try {
    const { text } = await generateText({
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      prompt: `You are a professional navigation assistant. Create a summarized driving itinerary to ${destination}.

      Rules:
      1. Format: Output a SINGLE, flowing paragraph. DO NOT use numbered lists.
      2. Start: Begin the paragraph with "From [City], take..." (use "${startAddress}" for the location). If the city is unknown, start with "From your starting location, take...".
      3. Content: Describe the route using the provided data points as a guide for major road changes. Focus on the major highways and the final approach. 
      4. Length: Max 75 words.
      
      Route Data: ${JSON.stringify(simplifiedSteps)}`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("Vercel AI SDK Error:", error);
    return res.status(500).json({ error: "Generation failed", details: error.message });
  }
}
