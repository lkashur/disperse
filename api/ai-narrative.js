import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const hf = createHuggingFace({ apiKey: process.env.HF_TOKEN });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { osrmData, destination, startAddress } = req.body;
  const feature = osrmData?.features?.[0]; 

  if (!feature) return res.status(400).json({ error: "Route data not found." });

  // 1. SMART NAME HANDLING:
  // Check if destination is a valid name or just a number/null
  let safeDestination = destination;
  if (!safeDestination || safeDestination === 'null' || safeDestination.length < 3 || /^\d+$/.test(safeDestination)) {
    safeDestination = "your selected forest destination";
  }

  // 2. Logic: Aggregate consecutive segments
  const rawSteps = feature.properties.segments[0].steps;
  const aggregated = [];
  
  rawSteps.forEach(step => {
    if (!step.name || step.name.includes("roundabout")) return;
    
    const last = aggregated[aggregated.length - 1];
    if (last && last.name === step.name) {
      last.distance += step.distance;
    } else {
      aggregated.push({ name: step.name, distance: step.distance });
    }
  });

  const routeSummary = aggregated.map(s => ({
    name: s.name,
    miles: (s.distance / 1609.34).toFixed(1)
  }));

  const totalMiles = (feature.properties.summary.distance / 1609.34).toFixed(0);

  try {
    const { text } = await generateText({
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      prompt: `You are a professional navigation assistant. Write a concise, professional summary of the route.

      DATA:
      - Origin: ${startAddress}
      - Destination: ${safeDestination}
      - Total Distance: ${totalMiles} miles
      - Route Steps: ${JSON.stringify(routeSummary)}

      INSTRUCTIONS:
      1. NARRATE: Write a professional paragraph describing the journey.
      2. PRIORITIZE: Focus only on major highway transitions, significant road changes, and the final approach.
      3. ENDING: Conclude with: "...to arrive at ${safeDestination}."
      4. LENGTH: Keep it under 60 words. No fluff.`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("AI Error:", error);
    return res.status(500).json({ error: "Generation failed" });
  }
}
