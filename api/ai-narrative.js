import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const hf = createHuggingFace({
  apiKey: process.env.HF_TOKEN,
});

// Normalizes road names to ensure "Highway" and "Hwy" are treated as the same road
function getCanonicalName(name) {
  if (!name) return "the main road";
  return name
    .replace(/\b(Hwy|Hwy\.|Highway|Rd\.|Road|St\.|Street|Ave\.|Avenue|Freeway|Fwy)\b/gi, "")
    .trim()
    .toLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { osrmData, destination, startAddress } = req.body;
  const steps = osrmData?.routes?.[0]?.legs?.[0]?.steps;

  if (!steps || steps.length === 0) {
    return res.status(400).json({ error: "Navigation steps not found." });
  }

  // 1. Merge consecutive steps if names are effectively identical
  const mergedSteps = steps.reduce((acc, step) => {
    const canonicalName = getCanonicalName(step.name);
    const lastStep = acc[acc.length - 1];
    
    if (lastStep && getCanonicalName(lastStep.name) === canonicalName) {
      lastStep.distance += step.distance;
    } else {
      acc.push({ name: step.name || "the road", distance: step.distance });
    }
    return acc;
  }, []);

  // 2. Filter: Only keep major segments (> 10 miles / ~16093 meters)
  const majorRoute = mergedSteps
    .filter(step => step.distance > 16093) 
    .map(step => ({
      road: step.name,
      distance: `${(step.distance / 1609.34).toFixed(0)} miles`
    }));

  try {
    const { text } = await generateText({
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      prompt: `You are a professional travel navigator. Summarize the trip from "${startAddress}" to "${destination}".

      RULES:
      1. FAITHFULNESS: Use ONLY the road names and distances in the provided JSON data. Do not hallucinate turns or road names not present.
      2. FORMAT: Output a single, professional, flowing paragraph. Do not use lists or numbers.
      3. STARTING POINT: Begin your response with: "From ${startAddress}, you will..."
      4. CONTENT: Focus on the major highway segments provided. Ignore local residential streets or small connectors.
      5. LENGTH: Max 60 words.

      Route Data: ${JSON.stringify(majorRoute)}`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("Vercel AI SDK Error:", error);
    return res.status(500).json({ error: "Generation failed", details: error.message });
  }
}
