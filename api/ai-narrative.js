export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  console.log("--- Backend Debug Start ---");
  
  try {
    const { osrmData, destination } = req.body;
    
    // Check if token exists
    if (!process.env.HF_TOKEN) {
      console.error("CRITICAL: HF_TOKEN is missing!");
      return res.status(500).json({ error: "Configuration Error: Token Missing" });
    }

    console.log("Attempting fetch to Hugging Face...");

    const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: `[INST] Summarize these navigation instructions for ${destination}: ${JSON.stringify(osrmData)} [/INST]`
      })
    });

    console.log(`Hugging Face responded with status: ${response.status}`);
    
    const responseText = await response.text();
    console.log("Hugging Face full response:", responseText);

    if (!response.ok) {
        throw new Error(`HF API returned ${response.status}: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    return res.status(200).json(data);

  } catch (err) {
    console.error("--- CATCH BLOCK ERROR ---");
    console.error("Full Error Message:", err.message);
    console.error("Full Stack Trace:", err.stack);
    
    return res.status(500).json({ 
      error: "Backend failed", 
      details: err.message 
    });
  }
}
