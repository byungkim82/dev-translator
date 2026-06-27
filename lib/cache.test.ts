import { describe, expect, it, vi } from "vitest";
import {
  findCachedTranslation,
  normalizeKoreanInput,
  type CacheDB,
  type CachedTranslation,
} from "./cache";

describe("normalizeKoreanInput", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeKoreanInput("  확인 부탁해  ")).toBe("확인 부탁해");
  });

  it("leaves internal whitespace intact", () => {
    expect(normalizeKoreanInput("확인  부탁해")).toBe("확인  부탁해");
  });

  it("returns an empty string for whitespace-only input", () => {
    expect(normalizeKoreanInput("  \n\t ")).toBe("");
  });
});

const ROW: CachedTranslation = {
  id: "t1",
  korean_text: "확인 부탁해",
  english_text: "Could you take a look?",
  model: "gemini-flash-lite",
  style: "casual-work",
  category: null,
  is_favorite: 0,
  created_at: "2026-01-01T00:00:00.000Z",
};

function makeDb(row: CachedTranslation | null) {
  const first = vi.fn(async () => row);
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));
  const db = { prepare } as unknown as CacheDB;
  return { db, prepare, bind, first };
}

describe("findCachedTranslation", () => {
  it("binds the trimmed text, style, and model to the query", async () => {
    const { db, bind } = makeDb(null);
    await findCachedTranslation(db, "  확인 부탁해  ", "casual-work", "gemini-flash-lite");
    expect(bind).toHaveBeenCalledWith(
      "확인 부탁해",
      "casual-work",
      "gemini-flash-lite"
    );
  });

  it("returns the stored row on a cache hit", async () => {
    const { db } = makeDb(ROW);
    await expect(
      findCachedTranslation(db, "확인 부탁해", "casual-work", "gemini-flash-lite")
    ).resolves.toBe(ROW);
  });

  it("returns null on a cache miss", async () => {
    const { db } = makeDb(null);
    await expect(
      findCachedTranslation(db, "처음 보는 문장", "casual-work", "gemini-flash-lite")
    ).resolves.toBeNull();
  });

  it("restricts the lookup to plain rows (had_examples = 0)", async () => {
    const { db, prepare } = makeDb(null);
    await findCachedTranslation(db, "확인 부탁해", "casual-work", "gemini-flash-lite");
    // Example-influenced rows must never be served to a plain request (P16 P2).
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("had_examples = 0"));
  });
});
