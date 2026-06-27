import { describe, expect, it, vi } from "vitest";
import { backfillEmbeddingBatch, type BackfillDB } from "./backfill";
import {
  EDGE_EMBEDDING_MODEL,
  EDGE_EMBEDDING_VERSION,
  type EmbeddingAI,
} from "./ai/embedding-edge";

interface PendingRow {
  id: string;
  korean_text: string;
}

// Fake D1: bind() exposes both all() (the select page) and run() (the updates).
function makeDb(rows: PendingRow[]) {
  const run = vi.fn(async () => ({}));
  const all = vi.fn(async () => ({ results: rows }));
  const bind = vi.fn(() => ({ run, all }));
  const prepare = vi.fn(() => ({ bind }));
  const db = { prepare } as unknown as BackfillDB;
  return { db, prepare, bind, run, all };
}

function makeAi(vector: number[]) {
  const run = vi.fn(async () => ({ data: [vector] }));
  return { ai: { run } as unknown as EmbeddingAI, run };
}

describe("backfillEmbeddingBatch", () => {
  it("embeds each pending row and stores its vector + version, returning the count", async () => {
    const { db, bind } = makeDb([
      { id: "a", korean_text: "리뷰 부탁해" },
      { id: "b", korean_text: "배포 끝났어" },
    ]);
    const vec = [0.1, 0.2];
    const { ai, run: aiRun } = makeAi(vec);

    const result = await backfillEmbeddingBatch(db, ai, 50);

    expect(result).toEqual({ processed: 2 });
    expect(aiRun).toHaveBeenCalledWith(EDGE_EMBEDDING_MODEL, { text: "리뷰 부탁해" });
    expect(aiRun).toHaveBeenCalledWith(EDGE_EMBEDDING_MODEL, { text: "배포 끝났어" });
    expect(bind).toHaveBeenCalledWith(JSON.stringify(vec), EDGE_EMBEDDING_VERSION, "a");
    expect(bind).toHaveBeenCalledWith(JSON.stringify(vec), EDGE_EMBEDDING_VERSION, "b");
  });

  it("does nothing and returns 0 when no rows are pending", async () => {
    const { db } = makeDb([]);
    const { ai, run: aiRun } = makeAi([0.1]);

    const result = await backfillEmbeddingBatch(db, ai);

    expect(result).toEqual({ processed: 0 });
    expect(aiRun).not.toHaveBeenCalled();
  });

  it("passes the page limit to the select query", async () => {
    const { db, bind } = makeDb([]);
    const { ai } = makeAi([0.1]);

    await backfillEmbeddingBatch(db, ai, 25);

    expect(bind).toHaveBeenCalledWith(25);
  });
});
