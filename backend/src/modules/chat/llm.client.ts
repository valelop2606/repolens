/**
 * Provider-agnostic LLM client. The chat service only depends on this
 * interface, so swapping providers (Gemini, Anthropic, Groq...) is one class.
 */
export interface ChatTurn {
  role: string; // 'user' | 'assistant'
  content: string;
}

export interface LlmClient {
  complete(system: string, messages: ChatTurn[]): Promise<string>;
}

export const LLM_CLIENT = 'LLM_CLIENT';

type FetchFn = typeof fetch;

/**
 * Google Gemini via the public REST API (free tier available at
 * https://aistudio.google.com). No SDK needed.
 */
export class GeminiClient implements LlmClient {
  constructor(
    private readonly apiKey: string,
    private readonly model = 'gemini-flash-latest',
    private readonly fetchFn: FetchFn = fetch,
    private readonly retryDelaysMs: number[] = [1000, 3000],
  ) {}

  async complete(system: string, messages: ChatTurn[]): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    const request = () => this.fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
      }),
    });

    // 429/503 are transient on the free tier (rate limit / model overloaded): retry with backoff.
    // Network errors ("fetch failed") are retried the same way.
    const attempt = () => request().catch((err: unknown) => err as Error);
    let res = await attempt();
    for (const delay of this.retryDelaysMs) {
      if (!(res instanceof Error) && res.status !== 429 && res.status !== 503) break;
      await new Promise((r) => setTimeout(r, delay));
      res = await attempt();
    }
    if (res instanceof Error) throw res;

    if (!res.ok) {
      throw new Error(`Gemini API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  }
}
