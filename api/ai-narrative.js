import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const hf = createHuggingFace({
  apiKey: process.env.HF_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { osrmData, destination } = req.body;

  const steps = osrmData?.routes?.[0]?.legs?.[0]?.steps;
  
  if (!steps || steps.length === 0) {
    return res.status(400).json({ error: "Navigation steps not found." });
  }

  // Filter out tiny, useless segments (< 50 meters) to stop the AI from rambling
  const simplifiedSteps = steps
    .filter(step => step.distance > 50) 
    .map(step => ({
      instruction: step.maneuver.instruction,
      name: step.name || "the road",
      distance: `${(step.distance / 1609.34).toFixed(1)} miles`
    }));

  try {
    const { text } = await generateText({
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      prompt: `You are a friendly forest ranger guiding a DRIVER in a vehicle. Summarize these navigation instructions to reach ${destination}: ${JSON.stringify(simplifiedSteps)}.
      
      Strict rules for driving directions:
      - Assume the user is driving a vehicle. DO NOT mention walking, hiking, or pedestrians.
      - If an instruction says "head east" or "continue," assume the user is driving.
      - Use road names (like "${destination}") to guide the user.
      - Use simple distances (e.g., "drive 5 miles").
      - Write like a local giving directions: "Take [Road Name], drive [X] miles, then turn left onto [Road Name]."
      - Do not include raw data, JSON, or lists.
      - Max 50 words.`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("Vercel AI SDK Error:", error);
    return res.status(500).json({ error: "Generation failed", details: error.message });
  }
}
