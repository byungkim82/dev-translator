import { describe, expect, it, vi } from "vitest";
import {
  EDGE_EMBEDDING_MODEL,
  EDGE_EMBEDDING_VERSION,
  EDGE_SIMILARITY_THRESHOLD,
  getEdgeEmbedding,
  type EmbeddingAI,
} from "./embedding-edge";

describe("getEdgeEmbedding", () => {
  it("calls bge-m3 with the text and returns the first vector", async () => {
    const run = vi.fn(async () => ({ data: [[0.1, 0.2, 0.3]] }));
    const ai = { run } as unknown as EmbeddingAI;

    const vec = await getEdgeEmbedding(ai, "결제 확인");

    expect(vec).toEqual([0.1, 0.2, 0.3]);
    expect(run).toHaveBeenCalledWith(EDGE_EMBEDDING_MODEL, { text: "결제 확인" });
  });
});

describe("edge embedding constants (P16 §8)", () => {
  it("pins the bge-m3 model, version tag, and recalibrated threshold", () => {
    expect(EDGE_EMBEDDING_MODEL).toBe("@cf/baai/bge-m3");
    expect(EDGE_EMBEDDING_VERSION).toBe("bgem3-1024");
    expect(EDGE_SIMILARITY_THRESHOLD).toBe(0.68);
  });
});
