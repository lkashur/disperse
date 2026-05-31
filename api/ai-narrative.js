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

      Strict Rules:
      - Starting Location: Normalize the starting point. If the route begins in a city, start the summary with "From [City], take...". DO NOT mention specific street names for the first 1-2 miles.
      - Directional Language: Use relative turns (Turn left, Turn right, Merge) ONLY. Do not use cardinal directions (North, South, East, West).
      - Summarize: Focus on major transitions, highways, and significant arterials. Combine minor local road clusters into general directions.
      - Tone: Strictly neutral and direct. No filler, no conversational language.
      - Format: Single paragraph. Max 60 words.
      
      Route Data: ${JSON.stringify(simplifiedSteps)}`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("Vercel AI SDK Error:", error);
    return res.status(500).json({ error: "Generation failed", details: error.message });
  }
}
