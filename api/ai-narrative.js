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

  // 1. Merge consecutive steps that share the same road name
  // This cleans up the data so the AI only sees major road transitions
  const mergedSteps = steps.reduce((acc, step) => {
    const lastStep = acc[acc.length - 1];
    if (lastStep && step.name === lastStep.name) {
      lastStep.distance += step.distance;
    } else {
      acc.push({ name: step.name || "the road", distance: step.distance });
    }
    return acc;
  }, []);

  // 2. Filter: Only keep segments that are substantial (e.g., > 1 mile)
  // This automatically prunes small local residential roads
  const cleanData = mergedSteps
    .filter(step => step.distance > 1609) 
    .map(step => ({
      road: step.name,
      distance: `${(step.distance / 1609.34).toFixed(1)} miles`
    }));

  try {
    const { text } = await generateText({
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      prompt: `You are a professional navigator. Create a concise, human-readable driving summary to ${destination}.

      Rules:
      1. Start: Begin with "From [City], take..." (Use "${startAddress}" to identify the city).
      2. Format: Output a single, flowing paragraph. DO NOT use lists, DO NOT use numbers.
      3. Content: Describe the route as a sequence of road transitions using the provided road names and distances.
      4. Constraint: DO NOT invent maneuvers like "turn left" or "take the exit" if they are not in the data. Only describe the road name changes.
      5. Length: Max 75 words.
      
      Route Data: ${JSON.stringify(cleanData)}`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("Vercel AI SDK Error:", error);
    return res.status(500).json({ error: "Generation failed", details: error.message });
  }
}
