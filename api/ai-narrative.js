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
      prompt: `You are a professional navigation assistant. Provide a summary to ${destination}.

      Strict Rules:
      - Start: Use "From [City/Town], take..." based on "${startAddress}". If no city is apparent, use "From the starting area, take...".
      - Exclude: Do NOT name the specific starting street. 
      - Simplify: Condense local departures into one phrase.
      - Maneuvers: Use "Turn", "Merge", or "Take exit". 
      - Tone: Neutral, direct.
      - Constraint: Max 60 words.
      
      Data: ${JSON.stringify(simplifiedSteps)}`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("Vercel AI SDK Error:", error);
    return res.status(500).json({ error: "Generation failed", details: error.message });
  }
}
