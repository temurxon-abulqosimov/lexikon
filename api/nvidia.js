const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

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

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "OpenRouter API key not configured" });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const upstream = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://lexikon-dun.vercel.app",
        "X-Title": "Lexikon",
      },
      body: JSON.stringify({
        model: model || "inclusionai/ling-3.0-flash:free",
        messages,
        temperature: temperature ?? 1,
        top_p: top_p ?? 1,
        max_tokens: max_tokens ?? 2048,
        stream: true,
      }),
    });

    clearTimeout(timeoutId);

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
    clearTimeout(timeoutId);
    const message = err.name === "AbortError" ? "OpenRouter API timed out" : err.message || "OpenRouter API request failed";
    if (!res.headersSent) {
      return res.status(504).json({ error: message });
    }
    res.end();
  }
}
