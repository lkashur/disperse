import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const hf = createHuggingFace({ apiKey: process.env.HF_TOKEN });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { osrmData, destination, startAddress } = req.body;
  const feature = osrmData?.features?.[0]; 

  if (!feature) return res.status(400).json({ error: "Route data not found." });

  // DEBUGGING: Log the raw data so you can see exactly what names are being provided
  const rawSteps = feature.properties.segments[0].steps;
  console.log("DEBUG RAW STEPS:", JSON.stringify(rawSteps, null, 2));

  // Fix the "undefined" destination bug
  const targetDestination = destination && destination !== "null" ? destination : "your destination";

  try {
    const { text } = await generateText({
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      prompt: `You are a navigation assistant. Use the provided list of navigation steps to create a simple, accurate turn-by-turn guide.
      
      RAW STEPS (If a road name is weird, use the provided name): ${JSON.stringify(rawSteps)}
      
      RULES:
      1. ONLY USE THE DATA PROVIDED.
      2. If a segment is longer than 5 miles, mention the road name clearly.
      3. Do not invent road names. 
      4. If the destination is undefined or missing, call it "${targetDestination}".
      5. FORMAT: Use a numbered list.
      6. No "journey" talk. Just instructions.`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("AI Error:", error);
    return res.status(500).json({ error: "Generation failed" });
  }
}
