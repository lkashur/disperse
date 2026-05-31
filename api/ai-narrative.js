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

  // Filter: Keep only significant segments (>1km) or major turns/merges
  const simplifiedSteps = steps
    .filter(step => step.distance > 1000 || step.maneuver.type.includes('turn') || step.maneuver.type.includes('merge'))
    .map(step => ({
      instruction: step.maneuver.instruction,
      name: step.name || "the road",
      distance: `${(step.distance / 1609.34).toFixed(1)} miles`
    }));

  try {
    const { text } = await generateText({
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      prompt: `You are a neutral navigation assistant. Summarize the following route to ${destination} for a driver: ${JSON.stringify(simplifiedSteps)}.

      Rules:
      - Generalize the start: If the route begins in a residential or minor area, ignore the local street start. Begin the summary from the nearest major road, highway, or town.
      - Tone: Strictly professional, neutral, and direct. No filler, no greetings, no personality.
      - Content: Focus on major transitions, highway changes, and significant route turns only.
      - Formatting: Plain text paragraph. Max 60 words.`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("Vercel AI SDK Error:", error);
    return res.status(500).json({ error: "Generation failed", details: error.message });
  }
}
