import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const hf = createHuggingFace({ apiKey: process.env.HF_TOKEN });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { osrmData, destination, startAddress } = req.body;
  const feature = osrmData?.features?.[0]; 

  if (!feature) return res.status(400).json({ error: "Route data not found." });

  // 1. Process steps to filter out the 'chatter' (Keep left/right, continue straight)
  // We only keep the major transitions (changes in road name)
  const rawSteps = feature.properties.segments[0].steps;
  const majorTransitions = [];
  let currentRoad = "";

  rawSteps.forEach(step => {
    // Only capture segments with a name that is different from the previous one
    // This effectively merges "Keep left" and "Turn right" into the road change itself
    if (step.name && step.name !== currentRoad && !step.name.includes("roundabout")) {
      majorTransitions.push({ road: step.name });
      currentRoad = step.name;
    }
  });

  // 2. Clean up destination name (handle technical IDs)
  let safeDestination = destination;
  if (!safeDestination || safeDestination === 'null' || safeDestination.length < 3 || /^\d+$/.test(safeDestination)) {
    safeDestination = "your selected forest location";
  }

  const totalMiles = (feature.properties.summary.distance / 1609.34).toFixed(0);

  try {
    const { text } = await generateText({
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      prompt: `You are a professional navigation assistant. Provide a concise, objective summary of the route.

      DATA:
      - Origin: ${startAddress}
      - Destination: ${safeDestination}
      - Total Distance: ${totalMiles} miles
      - Route Sequence: ${JSON.stringify(majorTransitions)}

      INSTRUCTIONS:
      1. FORMAT: Write a single, fluid narrative paragraph.
      2. PROHIBITED: Do NOT use numbered lists, bullet points, or "step-by-step" formatting.
      3. TONE: Strictly professional and objective.
      4. CONTENT: Use the Route Sequence to describe the journey. Combine segments into a cohesive narrative (e.g., "From Santa Barbara, merge onto [Road] and continue until you transition to [Road]...").
      5. ENDING: Conclude with: "...to arrive at ${safeDestination}."
      6. LENGTH: Keep it brief (under 60 words).`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("AI Error:", error);
    return res.status(500).json({ error: "Generation failed" });
  }
}
