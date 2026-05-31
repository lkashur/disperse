import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const hf = createHuggingFace({
  apiKey: process.env.HF_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { osrmData, destination } = req.body;

  // 1. Safety check: Ensure the OSRM data structure exists
  const steps = osrmData?.routes?.[0]?.legs?.[0]?.steps;
  
  if (!steps || steps.length === 0) {
    return res.status(400).json({ error: "Navigation steps not found." });
  }

  // 2. Map steps to a simple instruction/distance format for the AI
  const simplifiedSteps = steps.map(step => ({
    instruction: step.maneuver.instruction,
    distance: `${(step.distance / 1609.34).toFixed(1)} miles`
  }));

  try {
    // 3. Generate the narrative with specific constraints
    const { text } = await generateText({
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      prompt: `You are a helpful forest guide. Summarize these navigation instructions to reach ${destination}: ${JSON.stringify(simplifiedSteps)}.
      
      Strict rules:
      - Write a friendly, conversational paragraph.
      - Use simple distances (e.g., "8 miles") when available in the instructions.
      - Do not list every turn as a sequence; focus on the main path.
      - If a road is unnamed or rural, describe it simply (e.g., "the dirt road").
      - No bullet points, no numbered lists, no raw JSON.
      - Keep it under 50 words.`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("Vercel AI SDK Error:", error);
    return res.status(500).json({ error: "Generation failed", details: error.message });
  }
}
