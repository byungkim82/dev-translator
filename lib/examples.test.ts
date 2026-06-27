import { describe, expect, it, vi } from "vitest";
import {
  buildExamplesLine,
  fetchExamplesByIds,
  selectFewShotExamples,
  EXAMPLE_SIMILARITY_THRESHOLD,
  type ExamplesDB,
  type FewShotExample,
} from "./examples";
import type { TranslationWithEmbedding } from "./similarity";

function makeT(
  id: string,
  embedding: number[] | null,
  is_favorite: number,
  korean_text = `ko-${id}`,
  english_text = `en-${id}`
): TranslationWithEmbedding {
  return {
    id,
    korean_text,
    english_text,
    embedding: embedding ? JSON.stringify(embedding) : null,
    model: "gemini-flash-lite",
    style: "casual-work",
    category: null,
    is_favorite,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("EXAMPLE_SIMILARITY_THRESHOLD", () => {
  it("uses the recalibrated bge-m3 cut-off (0.68), not the old OpenAI 0.75", () => {
    expect(EXAMPLE_SIMILARITY_THRESHOLD).toBe(0.68);
  });
});

describe("selectFewShotExamples", () => {
  const query = [1, 0];

  it("returns similar favorited translations as {korean, english} pairs", () => {
    const result = selectFewShotExamples(query, [
      makeT("fav-exact", [1, 0], 1, "이 코드 리뷰해줄 수 있어?", "Mind giving this a review?"),
    ]);
    expect(result).toEqual([
      { korean: "이 코드 리뷰해줄 수 있어?", english: "Mind giving this a review?" },
    ]);
  });

  it("excludes non-favorited candidates even when highly similar", () => {
    const result = selectFewShotExamples(query, [
      makeT("not-fav", [1, 0], 0),
    ]);
    expect(result).toHaveLength(0);
  });

  it("drops favorited candidates below the similarity threshold", () => {
    const result = selectFewShotExamples(query, [
      makeT("fav-orthogonal", [0, 1], 1), // similarity 0 < 0.75
    ]);
    expect(result).toHaveLength(0);
  });

  it("respects the limit (default 3)", () => {
    const candidates = [
      makeT("a", [1, 0], 1),
      makeT("b", [0.99, 0.01], 1),
      makeT("c", [0.98, 0.02], 1),
      makeT("d", [0.97, 0.03], 1),
    ];
    expect(selectFewShotExamples(query, candidates)).toHaveLength(3);
    expect(selectFewShotExamples(query, candidates, 0.75, 2)).toHaveLength(2);
  });
});

describe("buildExamplesLine", () => {
  it("returns an empty string when there are no examples (no-op)", () => {
    expect(buildExamplesLine([])).toBe("");
  });

  it("formats examples as arrow pairs under a voice-matching header", () => {
    const examples: FewShotExample[] = [
      { korean: "배포 다시 돌릴게", english: "I'll re-run the deploy" },
    ];
    const line = buildExamplesLine(examples);
    expect(line).toContain("match this voice");
    expect(line).toContain("- 배포 다시 돌릴게 → I'll re-run the deploy");
  });
});

interface ExampleRow {
  id: string;
  korean_text: string;
  english_text: string;
}

function row(id: string, korean_text: string, english_text: string): ExampleRow {
  return { id, korean_text, english_text };
}

function makeExamplesDb(rows: ExampleRow[]) {
  const all = vi.fn(async () => ({ results: rows }));
  const bind = vi.fn(() => ({ all }));
  const prepare = vi.fn(() => ({ bind }));
  const db = { prepare } as unknown as ExamplesDB;
  return { db, prepare, bind, all };
}

describe("fetchExamplesByIds", () => {
  it("returns examples in the requested id order (not SQL IN order)", async () => {
    const { db, bind } = makeExamplesDb([
      row("a", "리뷰 부탁", "Mind reviewing?"),
      row("b", "배포함", "Deployed it"),
    ]);
    const result = await fetchExamplesByIds(db, ["b", "a"]);
    expect(result).toEqual([
      { korean: "배포함", english: "Deployed it" },
      { korean: "리뷰 부탁", english: "Mind reviewing?" },
    ]);
    expect(bind).toHaveBeenCalledWith("b", "a");
  });

  it("caps at the limit, querying only the first N ids", async () => {
    const { db, bind } = makeExamplesDb([]);
    await fetchExamplesByIds(db, ["a", "b", "c", "d"], 2);
    expect(bind).toHaveBeenCalledWith("a", "b");
  });

  it("returns [] for no ids without touching the DB", async () => {
    const { db, prepare } = makeExamplesDb([]);
    const result = await fetchExamplesByIds(db, []);
    expect(result).toEqual([]);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("drops ids that have no matching row", async () => {
    const { db } = makeExamplesDb([row("a", "리뷰 부탁", "Mind reviewing?")]);
    const result = await fetchExamplesByIds(db, ["a", "missing"]);
    expect(result).toEqual([{ korean: "리뷰 부탁", english: "Mind reviewing?" }]);
  });
});
