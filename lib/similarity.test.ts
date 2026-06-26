import { describe, expect, it } from "vitest";
import {
  cosineSimilarity,
  findSimilarTranslations,
  type TranslationWithEmbedding,
} from "./similarity";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("returns 0 when either vector is all zeros (avoids divide-by-zero)", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(cosineSimilarity([1, 1], [0, 0])).toBe(0);
  });

  it("computes a known non-trivial value", () => {
    // [1,2,3]·[4,5,6] = 32 ; |a|=√14 ; |b|=√77 ; 32/√1078 ≈ 0.9746
    expect(cosineSimilarity([1, 2, 3], [4, 5, 6])).toBeCloseTo(0.9746, 4);
  });

  it("throws when vector lengths differ", () => {
    expect(() => cosineSimilarity([1, 2], [1])).toThrow();
  });
});

function makeT(
  id: string,
  embedding: number[] | null,
  overrides: Partial<TranslationWithEmbedding> = {}
): TranslationWithEmbedding {
  return {
    id,
    korean_text: "한국어",
    english_text: "english",
    embedding: embedding ? JSON.stringify(embedding) : null,
    model: "gemini-flash-lite",
    style: "casual-work",
    category: null,
    is_favorite: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("findSimilarTranslations", () => {
  const query = [1, 0];

  it("keeps only results above the threshold and sorts by similarity desc", () => {
    const items = [
      makeT("exact", [1, 0]), // sim 1.0
      makeT("near", [0.9, 0.1]), // sim ≈ 0.994
      makeT("orthogonal", [0, 1]), // sim 0 -> excluded
    ];

    const result = findSimilarTranslations(query, items);

    expect(result.map((r) => r.id)).toEqual(["exact", "near"]);
    expect(result[0].similarity).toBeGreaterThanOrEqual(result[1].similarity);
  });

  it("attaches a similarity score to each result", () => {
    const result = findSimilarTranslations(query, [makeT("exact", [1, 0])]);
    expect(result[0].similarity).toBeCloseTo(1);
  });

  it("skips entries with a null embedding", () => {
    const result = findSimilarTranslations(query, [makeT("no-embedding", null)]);
    expect(result).toHaveLength(0);
  });

  it("skips entries whose embedding JSON is malformed", () => {
    const broken = makeT("broken", [1, 0]);
    broken.embedding = "not-valid-json";
    expect(findSimilarTranslations(query, [broken])).toHaveLength(0);
  });

  it("respects a custom threshold (strictly greater than)", () => {
    const items = [makeT("orthogonal", [0, 1])]; // sim 0
    expect(findSimilarTranslations(query, items, 0)).toHaveLength(0);
  });

  it("respects the limit parameter", () => {
    const items = [
      makeT("a", [1, 0]),
      makeT("b", [0.99, 0.01]),
      makeT("c", [0.95, 0.05]),
    ];
    const result = findSimilarTranslations(query, items, 0.85, 2);
    expect(result).toHaveLength(2);
  });
});
