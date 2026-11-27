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
  ) {}

  async complete(system: string, messages: ChatTurn[]): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    const res = await this.fetchFn(url, {
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

    if (!res.ok) {
      throw new Error(`Gemini API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  }
}
