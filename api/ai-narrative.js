export default async function handler(req, res) {
  try {
    // 1. Can we reach Google? (Tests basic connectivity)
    const googleRes = await fetch('https://www.google.com');
    console.log("Can reach Google:", googleRes.status === 200);

    // 2. Can we resolve the Hugging Face host?
    const dns = await import('dns/promises');
    const lookup = await dns.lookup('api-inference.huggingface.co');
    console.log("Hugging Face DNS Lookup:", lookup);

    res.status(200).json({ status: "Diagnostic complete", dns: lookup });
  } catch (error) {
    console.error("Diagnostic Failed:", error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
}
