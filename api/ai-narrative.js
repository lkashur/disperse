import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const hf = createHuggingFace({ apiKey: process.env.HF_TOKEN });

function extractCity(address) {
  if (!address) return "your starting location";
  const parts = address.split(',');
  return parts.length > 1 ? parts[1].trim() : address;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // osrmData now contains the GeoJSON FeatureCollection
  const { osrmData, destination, startAddress } = req.body;
  const feature = osrmData?.features?.[0]; // ORS GeoJSON structure

  if (!feature) return res.status(400).json({ error: "Route data not found." });

  // ORS stores segments/steps in properties
  const allSteps = feature.properties.segments[0].steps;
  const majorHighways = [...new Set(
    allSteps
      .filter(step => step.distance > 24140 && step.name && step.name.length > 3)
      .map(step => step.name)
  )];

  const city = extractCity(startAddress);
  // ORS stores summary in properties
  const totalMiles = (feature.properties.summary.distance / 1609.34).toFixed(0);
  const firstRoad = majorHighways[0] || "the main route";

  try {
    const { text } = await generateText({
      model: hf('meta-llama/Meta-Llama-3-8B-Instruct'),
      prompt: `You are a travel writer summarizing a trip to ${destination}.

      DATA:
      - Starting City: ${city}
      - First Road: ${firstRoad}
      - Major Corridors: ${majorHighways.join(", ")}
      - Total Distance: ${totalMiles} miles

      INSTRUCTIONS:
      1. START: You MUST start the paragraph with: "From ${city}, take ${firstRoad} to..."
      2. SUMMARY: Provide a natural, concise summary of the trip focusing on the major corridors.
      3. FAITHFULNESS: Do not mention local streets, exits, or turns. 
      4. LENGTH: Max 50 words.
      5. TONE: Professional and clear.`,
    });

    return res.status(200).json({ generated_text: text });
    
  } catch (error) {
    console.error("AI Error:", error);
    return res.status(500).json({ error: "Generation failed" });
  }
}
