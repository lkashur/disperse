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
  // This preserves local connectors while removing "keep straight" noise.
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
      - Summarize the route: Focus on major transitions, highways, and major arterials.
      - Combine local navigation: If there is a sequence of minor neighborhood/local road turns, combine them into a single instruction (e.g., "Navigate local roads for 1.2 miles to reach Highway 101").
      - Tone: Strictly neutral and direct. No filler, no greetings, no conversational language.
      - Format: Single paragraph. Max 60 words.
      
      Route Data: ${JSON.stringify(simplifiedSteps)}`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("Vercel AI SDK Error:", error);
    return res.status(500).json({ error: "Generation failed", details: error.message });
  }
}
