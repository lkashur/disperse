import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const hf = createHuggingFace({ apiKey: process.env.HF_TOKEN });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { osrmData, destination, startAddress } = req.body;
  const feature = osrmData?.features?.[0]; 

  if (!feature) return res.status(400).json({ error: "Route data not found." });

  // 1. DATA PARSING: Filter for Major Highways and the Final Approach
  const rawSteps = feature.properties.segments[0].steps;
  const majorTransitions = [];
  let currentRoad = "";
  
  // Logic: Only keep Highways or the very last step
  const isMajorRoad = (name) => /I-\d+|CA-|US-|Freeway|Hwy|Expressway|State Route|Highway/i.test(name);

  rawSteps.forEach((step, index) => {
    if (!step.name) return;
    const isLastStep = index === rawSteps.length - 1;
    const isNewRoad = step.name !== currentRoad;
    
    if (isNewRoad && (isMajorRoad(step.name) || isLastStep)) {
      majorTransitions.push({ road: step.name });
      currentRoad = step.name;
    }
  });

  // 2. NAME CLEANUP: Sanity check for forest road IDs
  let safeDestination = destination;
  if (!safeDestination || /^\d+$/.test(safeDestination) || safeDestination === 'null') {
    safeDestination = "your forest destination";
  }

  try {
    const { text } = await generateText({
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      prompt: `You are a helpful local friend giving directions.
      
      DATA:
      - Origin: ${startAddress}
      - Destination: ${safeDestination}
      - Major Route Changes: ${JSON.stringify(majorTransitions)}

      INSTRUCTIONS:
      1. PERSONA: You are a local driver. Use conversational, natural language.
      2. NAMING: Use local naming conventions (e.g., call "I-5" "The 5", "US-101" "The 101").
      3. SENSE: If a road name is purely technical (like a forest service number), refer to it naturally as "the turn-off" or "the forest road".
      4. STYLE: Do not use numbered lists. Keep it to 3-4 natural sentences. 
      5. EXAMPLES: "From Santa Barbara, hop on The 118 and take it over to The 5. Follow that until you catch The 14 heading out toward the desert, then look for the turn-off onto the local forest roads to arrive at your destination."
      6. ENDING: Conclude with: "...to arrive at ${safeDestination}."
      7. TONE: No fluff, no "journey" talk, just helpful, brief directions.`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("AI Error:", error);
    return res.status(500).json({ error: "Generation failed" });
  }
}
