import { describe, expect, it } from "vitest";
import { estimateTokens, generateId } from "./utils";

describe("estimateTokens", () => {
  it("returns 0 for an empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("rounds up partial tokens", () => {
    // 1 / 1.3 = 0.769 -> ceil -> 1
    expect(estimateTokens("a")).toBe(1);
  });

  it("estimates ~1.3 chars per token", () => {
    // 13 / 1.3 = 10 exactly
    expect(estimateTokens("a".repeat(13))).toBe(10);
    // 14 / 1.3 = 10.77 -> 11
    expect(estimateTokens("a".repeat(14))).toBe(11);
  });
});

describe("generateId", () => {
  it("returns a v4 UUID string", () => {
    expect(generateId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("returns a unique value on each call", () => {
    expect(generateId()).not.toBe(generateId());
  });
});
