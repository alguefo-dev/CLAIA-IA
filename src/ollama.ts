export type Msg = { role: "system" | "user" | "assistant"; content: string };

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5-coder:7b";
export async function chat(messages: Msg[]): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      keep_alive: "30m",
      options: { num_ctx: 4096, temperature: 0.2 },
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Claia respondió ${res.status}: ${await res.text()}`);
  }


  
  if (!res.ok || !res.body) {
    throw new Error(`Claia respondió ${res.status}: ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const chunk = JSON.parse(line);
      answer += chunk.message?.content ?? "";
    }
  }
  return answer.trim();
}