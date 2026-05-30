import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

// Initialize the provider
const hf = createHuggingFace({
  apiKey: process.env.HF_TOKEN,
});

export default async function handler(req, res) {
  // 1. Validate Request Method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Extract and Validate Input
  const { osrmData, destination } = req.body;
  
  if (!osrmData || !destination) {
    console.error("400 Error: Missing data in request body", { osrmData, destination });
    return res.status(400).json({ error: "Missing required data: osrmData or destination" });
  }

  try {
    // 3. Minification: Strip heavy geometry, keep only instructions
    const simplifiedSteps = osrmData.routes[0].legs[0].steps.map(step => ({
      instruction: step.maneuver.instruction,
      distance: step.distance
    }));

    // 4. Generate Narrative
    const { text } = await generateText({
      model: hf('mistralai/Mistral-7B-Instruct-v0.3'),
      prompt: `[INST] Summarize these navigation instructions for ${destination}: ${JSON.stringify(simplifiedSteps)} [/INST]`,
    });

    return res.status(200).json({ generated_text: text });

  } catch (error) {
    // 5. Verbose Logging for Debugging the 400/500 errors
    console.error("--- FULL ERROR START ---");
    console.error("Message:", error.message);
    console.error("Cause:", error.cause);
    
    // Log the input that caused the failure to help identify malformed data
    console.error("Input received:", JSON.stringify(req.body).substring(0, 500) + "...");
    console.error("--- FULL ERROR END ---");

    return res.status(500).json({ 
      error: "Backend processing failed", 
      details: error.message 
    });
  }
}
