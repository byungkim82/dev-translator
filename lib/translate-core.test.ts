import { describe, expect, it, vi } from "vitest";
import { finalizeTranslation, type InsertDB, type NewTranslationRow } from "./translate-core";

function makeDb() {
  const run = vi.fn(async () => ({}));
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));
  const db = { prepare } as unknown as InsertDB;
  return { db, prepare, bind, run };
}

const ROW: NewTranslationRow = {
  id: "t1",
  koreanText: "확인 부탁해",
  englishText: "Could you take a look?",
  model: "gemini-flash-lite",
  style: "casual-work",
  embedding: [0.1, 0.2],
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("finalizeTranslation", () => {
  it("binds all columns in order, serializing the embedding and deriving counts", async () => {
    const { db, bind, run } = makeDb();
    await finalizeTranslation(db, ROW);

    expect(bind).toHaveBeenCalledWith(
      "t1",
      "확인 부탁해",
      "Could you take a look?",
      "gemini-flash-lite",
      "casual-work",
      JSON.stringify([0.1, 0.2]),
      "확인 부탁해".length,
      Math.ceil("확인 부탁해".length / 1.3),
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z"
    );
    expect(run).toHaveBeenCalledOnce();
  });

  it("stores null when there is no embedding", async () => {
    const { db, bind } = makeDb();
    await finalizeTranslation(db, { ...ROW, embedding: null });

    expect(bind).toHaveBeenCalledWith(
      "t1",
      "확인 부탁해",
      "Could you take a look?",
      "gemini-flash-lite",
      "casual-work",
      null,
      "확인 부탁해".length,
      Math.ceil("확인 부탁해".length / 1.3),
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z"
    );
  });
});
