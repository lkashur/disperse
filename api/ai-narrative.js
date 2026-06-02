import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const hf = createHuggingFace({ apiKey: process.env.HF_TOKEN });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { osrmData, destination, startAddress } = req.body;
  const feature = osrmData?.features?.[0]; 

  if (!feature) return res.status(400).json({ error: "Route data not found." });

  // 1. Extract and Filter Steps
  // We keep the maneuvers (instructions) rather than just merging everything.
  const rawSteps = feature.properties.segments[0].steps;
  
  // We only care about major maneuvers (e.g., exits, turns, merges) 
  // and discard minor ones (like 'continue' or small local turns)
  const relevantSteps = rawSteps
    .filter(s => s.instruction && s.instruction.length > 5)
    .map(s => ({
      instruction: s.instruction,
      distance: (s.distance / 1609.34).toFixed(1)
    }));

  const totalMiles = (feature.properties.summary.distance / 1609.34).toFixed(0);
  
  // Clean up destination name
  let safeDestination = destination;
  if (!safeDestination || safeDestination === 'null' || safeDestination.length < 3 || /^\d+$/.test(safeDestination)) {
    safeDestination = "your selected forest destination";
  }

  try {
    const { text } = await generateText({
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      prompt: `You are a professional navigation system. Write a concise, step-by-step navigation guide.

      DATA:
      - Origin: ${startAddress}
      - Destination: ${safeDestination}
      - Total Distance: ${totalMiles} miles
      - Maneuvers: ${JSON.stringify(relevantSteps)}

      INSTRUCTIONS:
      1. STYLE: Strictly directional. Use imperative verbs (e.g., "Merge onto...", "Turn left...", "Take exit...").
      2. FLOW: Use the provided maneuvers to create a cohesive sequence.
      3. SUMMARY: If there is a long stretch of highway, summarize the distance (e.g., "Continue on I-5 for 50 miles"). 
      4. ENDING: Conclude with: "...to arrive at ${safeDestination}."
      5. LENGTH: Under 75 words. No fluff.`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("AI Error:", error);
    return res.status(500).json({ error: "Generation failed" });
  }
}
