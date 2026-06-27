import { describe, expect, it, vi } from "vitest";
import { EDGE_EMBEDDING_MODEL, getEdgeEmbedding, type EmbeddingAI } from "./embedding-edge";

describe("getEdgeEmbedding", () => {
  it("calls bge-m3 with the text and returns the first vector", async () => {
    const run = vi.fn(async () => ({ data: [[0.1, 0.2, 0.3]] }));
    const ai = { run } as unknown as EmbeddingAI;

    const vec = await getEdgeEmbedding(ai, "결제 확인");

    expect(vec).toEqual([0.1, 0.2, 0.3]);
    expect(run).toHaveBeenCalledWith(EDGE_EMBEDDING_MODEL, { text: "결제 확인" });
  });
});
