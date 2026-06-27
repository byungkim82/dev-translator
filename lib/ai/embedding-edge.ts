// Edge embedding via Cloudflare Workers AI — bge-m3 (1024-dim, multilingual,
// strong on Korean). Runs on the edge next to D1, so no external API round-trip.
// Kept behind a minimal injected interface so it can be unit-tested with a fake,
// the same approach as lib/cache.ts.

export const EDGE_EMBEDDING_MODEL = "@cf/baai/bge-m3";

// Version tag stored alongside every bge-m3 vector (in embedding_version). Reads
// gate on this so a future model swap can't compare incompatible vector spaces.
export const EDGE_EMBEDDING_VERSION = "bgem3-1024";

// Similarity cut-off recalibrated for bge-m3's distribution (design §8). bge-m3
// packs strong Korean paraphrases at ~0.7+ while noise overlaps lower, so 0.68
// fires only on genuine "special match" — much lower than the old OpenAI 0.85.
export const EDGE_SIMILARITY_THRESHOLD = 0.68;

// Return type is `unknown` so the real Workers AI `Ai` binding (whose run()
// resolves to a broad union) is assignable here without a call-site cast; the
// bge-m3 result shape is narrowed inside getEdgeEmbedding.
export interface EmbeddingAI {
  run(
    model: string,
    inputs: { text: string | string[] }
  ): Promise<unknown>;
}

interface EmbeddingResult {
  data: number[][];
}

export async function getEdgeEmbedding(
  ai: EmbeddingAI,
  text: string,
  model: string = EDGE_EMBEDDING_MODEL
): Promise<number[]> {
  const result = (await ai.run(model, { text })) as EmbeddingResult;
  return result.data[0];
}
