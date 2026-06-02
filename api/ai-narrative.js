import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const hf = createHuggingFace({ apiKey: process.env.HF_TOKEN });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { osrmData, destination, startAddress } = req.body;
  const feature = osrmData?.features?.[0]; 

  if (!feature) return res.status(400).json({ error: "Route data not found." });

  const rawSteps = feature.properties.segments[0].steps;

  // 1. SEMANTIC COMPRESSION: Group the journey into "Legs"
  // Categorize based on road type, not just name changes
  const routeLegs = rawSteps.map(step => {
    const isHighway = /I-\d+|CA-|US-|Freeway|Hwy/i.test(step.name);
    return {
      name: step.name,
      type: isHighway ? "HIGHWAY" : "LOCAL",
      distance: (step.distance / 1609.34).toFixed(1)
    };
  });

  // Filter: Keep only Highway changes and the Final Approach
  const simplifiedRoute = routeLegs.filter((leg, i) => {
    const isFinal = i === routeLegs.length - 1;
    const isHighwayChange = leg.type === "HIGHWAY" && (i === 0 || routeLegs[i-1].type !== "HIGHWAY");
    return isHighwayChange || isFinal;
  });

  const totalMiles = (feature.properties.summary.distance / 1609.34).toFixed(0);

  try {
    const { text } = await generateText({
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      prompt: `You are a navigation expert. Summarize the route into a professional, concise travel summary.

      DATA:
      - Departure: ${startAddress}
      - Destination: ${destination}
      - Route Overview: ${JSON.stringify(simplifiedRoute)}

      INSTRUCTIONS:
      1. STYLE: Write one cohesive paragraph.
      2. FOCUS: Describe the journey by major highways first.
      3. TRANSITION: Use a brief sentence for the final approach using the last item in the Route Overview.
      4. CONSTRAINTS: Do not list every road. Do not use bullet points. No conversational filler.
      5. ENDING: Conclude with: "...to arrive at ${destination}."`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("AI Error:", error);
    return res.status(500).json({ error: "Generation failed" });
  }
}
