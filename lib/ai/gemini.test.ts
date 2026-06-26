import { describe, expect, it } from "vitest";
import { cleanGeminiOutput, isTruncated } from "./gemini";

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
