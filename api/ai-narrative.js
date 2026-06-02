import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const hf = createHuggingFace({ apiKey: process.env.HF_TOKEN });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { osrmData, destination, startAddress } = req.body;
  const feature = osrmData?.features?.[0]; 

  if (!feature) return res.status(400).json({ error: "Route data not found." });

  // 1. DATA EXTRACTION: Get the raw instructions. 
  // We don't filter them out here, we let the AI handle the consolidation.
  const steps = feature.properties.segments[0].steps.map(s => ({
    instruction: s.instruction,
    distance: (s.distance / 1609.34).toFixed(1) + " miles"
  }));

  try {
    const { text } = await generateText({
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      prompt: `You are a professional navigation assistant.
      
      INPUT:
      - Origin: ${startAddress}
      - Destination: ${destination}
      - Steps: ${JSON.stringify(steps)}

      TASK:
      Combine the provided steps into a clear, reliable, professional turn-by-turn guide.
      
      RULES:
      1. ACCURACY IS PARAMOUNT: Do not skip turns or exits.
      2. CONSOLIDATE: If there are multiple "Keep Left/Right" or "Continue Straight" steps in a row on the same road, merge them into one instruction (e.g., "Continue on I-5 for 50 miles").
      3. FORMAT: Use a clean, numbered list.
      4. NO NARRATIVE: Do not use "journey," "traversing," or "hop on." Just provide the instruction.
      5. ENDING: End with: "Arrive at ${destination}."`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("AI Error:", error);
    return res.status(500).json({ error: "Generation failed" });
  }
}
