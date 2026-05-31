import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const hf = createHuggingFace({
  apiKey: process.env.HF_TOKEN,
});

// Helper to group roads even if they have slight naming variations
function getCanonicalName(name) {
  if (!name) return "the road";
  return name.replace(/\b(Hwy|Hwy\.|Highway|Rd\.|Road|St\.|Street|Ave\.|Avenue)\b/gi, "").trim().toLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { osrmData, destination, startAddress } = req.body;
  const steps = osrmData?.routes?.[0]?.legs?.[0]?.steps;

  if (!steps || steps.length === 0) {
    return res.status(400).json({ error: "Navigation steps not found." });
  }

  // 1. Group segments by road name
  const roadSegments = steps.reduce((acc, step) => {
    const canonicalName = getCanonicalName(step.name);
    const lastStep = acc[acc.length - 1];

    if (lastStep && getCanonicalName(lastStep.name) === canonicalName) {
      lastStep.distance += step.distance;
    } else {
      acc.push({ name: step.name || "the road", distance: step.distance });
    }
    return acc;
  }, []);

  // 2. Extract only MAJOR legs (segments > 3 miles / ~4800 meters)
  // This discards neighborhood noise while keeping the map route accurate
  const majorRoute = roadSegments
    .filter(step => step.distance > 4800) 
    .map(step => ({
      road: step.name,
      distance: `${(step.distance / 1609.34).toFixed(0)} miles`
    }));

  try {
    const { text } = await generateText({
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      prompt: `You are a navigator. Create a driving summary based on this route data: ${JSON.stringify(majorRoute)}.

      Rules:
      1. Start: Begin exactly with "From [City], take...". Extract the city from "${startAddress}".
      2. Format: Output a single, professional, flowing paragraph. DO NOT use numbered lists.
      3. Content: Describe the route as a sequence of road transitions. Use "Follow [Road] for [Distance]". 
      4. Constraint: DO NOT mention local residential streets. DO NOT invent turns. Only use the names and distances provided.
      5. Length: Max 75 words.`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("Vercel AI SDK Error:", error);
    return res.status(500).json({ error: "Generation failed", details: error.message });
  }
}
