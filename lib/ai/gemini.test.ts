import { describe, expect, it } from "vitest";
import { cleanGeminiOutput, isTruncated, streamGeminiText } from "./gemini";

describe("cleanGeminiOutput", () => {
  it("trims surrounding whitespace", () => {
    expect(cleanGeminiOutput("  hello  ")).toBe("hello");
  });

  it("strips one layer of surrounding double/single/backtick quotes", () => {
    expect(cleanGeminiOutput('"hello"')).toBe("hello");
    expect(cleanGeminiOutput("'hello'")).toBe("hello");
    expect(cleanGeminiOutput("`hello`")).toBe("hello");
  });

  it("removes a leading label prefix (case-insensitive)", () => {
    expect(cleanGeminiOutput("Translation: hello")).toBe("hello");
    expect(cleanGeminiOutput("English: hello")).toBe("hello");
    expect(cleanGeminiOutput("result: hello")).toBe("hello");
  });

  it("handles a quoted, prefixed response together", () => {
    expect(cleanGeminiOutput('"Translation: hello"')).toBe("hello");
  });

  it("leaves a clean translation untouched", () => {
    expect(cleanGeminiOutput("Could you take a look at this?")).toBe(
      "Could you take a look at this?"
    );
  });

  it("does not strip quotes that are internal to the text", () => {
    expect(cleanGeminiOutput('say "hi" there')).toBe('say "hi" there');
  });
});

describe("isTruncated", () => {
  it("is true when Gemini hit the output-token cap", () => {
    expect(isTruncated("MAX_TOKENS")).toBe(true);
  });

  it("is false for a normal completion", () => {
    expect(isTruncated("STOP")).toBe(false);
  });

  it("is false when no finishReason is provided", () => {
    expect(isTruncated(undefined)).toBe(false);
  });
});

describe("streamGeminiText", () => {
  function sseChunk(text?: string, finishReason?: string): string {
    const candidate = {
      ...(text !== undefined ? { content: { parts: [{ text }] } } : {}),
      ...(finishReason ? { finishReason } : {}),
    };
    return `data: ${JSON.stringify({ candidates: [candidate] })}\n\n`;
  }

  function sseResponse(events: string[], init: { ok?: boolean; status?: number } = {}): Response {
    const { ok = true, status = 200 } = init;
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (const e of events) c.enqueue(enc.encode(e));
        c.close();
      },
    });
    return { ok, status, body, text: async () => "error-body" } as unknown as Response;
  }

  function fakeFetch(res: Response): typeof fetch {
    return (async () => res) as unknown as typeof fetch;
  }

  async function collect(
    gen: AsyncGenerator<string, { truncated: boolean }, unknown>
  ): Promise<{ deltas: string[]; result: { truncated: boolean } }> {
    const deltas: string[] = [];
    for (;;) {
      const r = await gen.next();
      if (r.done) return { deltas, result: r.value };
      deltas.push(r.value);
    }
  }

  it("yields text deltas and reports truncated=false on STOP", async () => {
    const res = sseResponse([sseChunk("Hello"), sseChunk(" world", "STOP")]);
    const { deltas, result } = await collect(
      streamGeminiText("p", "k", "gemini-flash-lite", "casual-work", fakeFetch(res))
    );
    expect(deltas).toEqual(["Hello", " world"]);
    expect(result.truncated).toBe(false);
  });

  it("reports truncated=true when the final chunk is MAX_TOKENS", async () => {
    const res = sseResponse([sseChunk("partial"), sseChunk(undefined, "MAX_TOKENS")]);
    const { deltas, result } = await collect(
      streamGeminiText("p", "k", "gemini-flash-lite", "casual-work", fakeFetch(res))
    );
    expect(deltas).toEqual(["partial"]);
    expect(result.truncated).toBe(true);
  });

  it("throws a quota error on HTTP 429", async () => {
    const res = sseResponse([], { ok: false, status: 429 });
    await expect(
      collect(streamGeminiText("p", "k", "gemini-flash-lite", "casual-work", fakeFetch(res)))
    ).rejects.toThrow("한도");
  });
});
