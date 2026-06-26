import { describe, expect, it } from "vitest";
import { createSseParser, extractDelta } from "./sse";

function dataLine(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n`;
}

function geminiChunk(text?: string, finishReason?: string) {
  return {
    candidates: [
      {
        ...(text !== undefined
          ? { content: { parts: [{ text }] } }
          : { content: { parts: [] } }),
        ...(finishReason ? { finishReason } : {}),
      },
    ],
  };
}

describe("createSseParser", () => {
  it("parses a single complete data line", () => {
    const p = createSseParser();
    const objs = p.push(dataLine(geminiChunk("Hello")));
    expect(objs).toHaveLength(1);
    expect(extractDelta(objs[0]).text).toBe("Hello");
  });

  it("does not parse a JSON fragment until its newline arrives (split mid-JSON)", () => {
    const p = createSseParser();
    expect(p.push('data: {"candidates":[{"content":{"parts":[{"text":"Hel')).toEqual([]);
    const objs = p.push('lo"}]}}]}\n');
    expect(objs).toHaveLength(1);
    expect(extractDelta(objs[0]).text).toBe("Hello");
  });

  it("emits both events when two arrive in one read", () => {
    const p = createSseParser();
    const objs = p.push(dataLine(geminiChunk("A")) + dataLine(geminiChunk("B")));
    expect(objs.map((o) => extractDelta(o).text)).toEqual(["A", "B"]);
  });

  it("keeps a trailing partial line buffered (no newline yet)", () => {
    const p = createSseParser();
    expect(p.push(`data: ${JSON.stringify(geminiChunk("nope"))}`)).toEqual([]);
  });

  it("ignores blank lines, comments, and [DONE]", () => {
    const p = createSseParser();
    const objs = p.push(`\n: comment\nevent: x\ndata: [DONE]\n${dataLine(geminiChunk("ok"))}`);
    expect(objs.map((o) => extractDelta(o).text)).toEqual(["ok"]);
  });

  it("tolerates CRLF line endings", () => {
    const p = createSseParser();
    const objs = p.push(`data: ${JSON.stringify(geminiChunk("x"))}\r\n`);
    expect(extractDelta(objs[0]).text).toBe("x");
  });
});

describe("extractDelta", () => {
  it("returns the text from a content chunk", () => {
    expect(extractDelta(geminiChunk("hi"))).toEqual({ text: "hi", finishReason: undefined });
  });

  it("returns finishReason with no text on a final MAX_TOKENS chunk", () => {
    expect(extractDelta(geminiChunk(undefined, "MAX_TOKENS"))).toEqual({
      text: undefined,
      finishReason: "MAX_TOKENS",
    });
  });

  it("returns both text and finishReason on a final STOP chunk", () => {
    expect(extractDelta(geminiChunk("end.", "STOP"))).toEqual({
      text: "end.",
      finishReason: "STOP",
    });
  });

  it("does not crash on empty or malformed chunks", () => {
    expect(extractDelta({})).toEqual({ text: undefined, finishReason: undefined });
    expect(extractDelta(null)).toEqual({ text: undefined, finishReason: undefined });
    expect(extractDelta({ candidates: [] })).toEqual({ text: undefined, finishReason: undefined });
  });
});
