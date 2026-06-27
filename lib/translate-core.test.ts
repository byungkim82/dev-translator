import { describe, expect, it, vi } from "vitest";
import {
  finalizeTranslation,
  recordEdgeEmbedding,
  type InsertDB,
  type NewTranslationRow,
} from "./translate-core";
import {
  EDGE_EMBEDDING_MODEL,
  EDGE_EMBEDDING_VERSION,
  type EmbeddingAI,
} from "./ai/embedding-edge";

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

describe("recordEdgeEmbedding", () => {
  it("embeds the text with bge-m3 and updates the row's vector + version", async () => {
    const { db, prepare, bind, run } = makeDb();
    const aiRun = vi.fn(async () => ({ data: [[0.4, 0.5, 0.6]] }));
    const ai = { run: aiRun } as unknown as EmbeddingAI;

    await recordEdgeEmbedding(db, ai, { id: "t9", text: "배포 끝났어" });

    expect(aiRun).toHaveBeenCalledWith(EDGE_EMBEDDING_MODEL, { text: "배포 끝났어" });
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE translations"));
    expect(bind).toHaveBeenCalledWith(
      JSON.stringify([0.4, 0.5, 0.6]),
      EDGE_EMBEDDING_VERSION,
      "t9"
    );
    expect(run).toHaveBeenCalledOnce();
  });
});
