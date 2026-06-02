import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const hf = createHuggingFace({ apiKey: process.env.HF_TOKEN });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { osrmData, destination, startAddress } = req.body;
  const feature = osrmData?.features?.[0]; 

  if (!feature) return res.status(400).json({ error: "Route data not found." });

  // Filter: Keep only major roads/highways
  const rawSteps = feature.properties.segments[0].steps;
  const majorTransitions = [];
  let currentRoad = "";
  
  const isMajorRoad = (name) => /I-\d+|CA-|US-|Freeway|Hwy|Expressway|State Route|Highway/i.test(name);

  rawSteps.forEach((step, index) => {
    if (!step.name) return;
    const isLastStep = index === rawSteps.length - 1;
    if (step.name !== currentRoad && (isMajorRoad(step.name) || isLastStep)) {
      majorTransitions.push({ road: step.name, distance: (step.distance / 1609.34).toFixed(1) });
      currentRoad = step.name;
    }
  });

  try {
    const { text } = await generateText({
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      prompt: `You are a GPS unit. Output ONLY instructions using the format below.

      DATA:
      - Transitions: ${JSON.stringify(majorTransitions)}
      - Arrival: ${destination}

      FORMAT:
      Take [Road] for [Distance] miles. 
      Merge onto [Road] for [Distance] miles.
      Continue on [Road] for [Distance] miles.
      Arrive at [Arrival].

      RULES:
      1. Use ONLY the data provided.
      2. No introduction. No conclusion. No filler words.
      3. No "narrative" flow.
      4. If the instruction is just to arrive, use "Arrive at [Arrival]."`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("AI Error:", error);
    return res.status(500).json({ error: "Generation failed" });
  }
}
