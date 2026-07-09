const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages, temperature, top_p, max_tokens, model } = req.body;

  const isGemma = (model || "").includes("gemma");
  const apiKey = isGemma
    ? (process.env.NVIDIA_GEMMA_API_KEY || process.env.NVIDIA_API_KEY)
    : process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "NVIDIA API key not configured" });
  }

  try {
    const upstream = await fetch(NVIDIA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "openai/gpt-oss-120b",
        messages,
        temperature: temperature ?? 1,
        top_p: top_p ?? 1,
        max_tokens: max_tokens ?? 3072,
        stream: true,
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return res.status(upstream.status).json({ error: errText });
    }

    // True SSE streaming: forward chunks to client as they arrive
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }

    res.end();
  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message || "NVIDIA API request failed" });
    }
    res.end();
  }
}