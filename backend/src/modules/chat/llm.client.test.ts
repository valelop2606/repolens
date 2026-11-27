import { GeminiClient } from './llm.client';

describe('GeminiClient', () => {
  const okResponse = (text: string) =>
    ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    }) as unknown as Response;

  it('maps roles and system prompt to the Gemini request format', async () => {
    const fetchFn = jest.fn().mockResolvedValue(okResponse('Hello'));
    const client = new GeminiClient('key-123', 'gemini-test', fetchFn as unknown as typeof fetch);

    const text = await client.complete('system prompt', [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hey' },
      { role: 'user', content: 'what is this repo?' },
    ]);

    expect(text).toBe('Hello');
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toContain('/models/gemini-test:generateContent');
    expect(init.headers['x-goog-api-key']).toBe('key-123');
    const body = JSON.parse(init.body);
    expect(body.systemInstruction.parts[0].text).toBe('system prompt');
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user']);
  });

  it('throws on non-2xx responses', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'quota' });
    const client = new GeminiClient('key', 'm', fetchFn as unknown as typeof fetch);
    await expect(client.complete('s', [{ role: 'user', content: 'q' }])).rejects.toThrow('429');
  });

  it('throws when the API key is missing', async () => {
    const client = new GeminiClient('', 'm', jest.fn() as unknown as typeof fetch);
    await expect(client.complete('s', [])).rejects.toThrow('GEMINI_API_KEY');
  });
});
