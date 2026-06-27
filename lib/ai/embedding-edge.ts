// Edge embedding via Cloudflare Workers AI — bge-m3 (1024-dim, multilingual,
// strong on Korean). Runs on the edge next to D1, so no external API round-trip.
// Kept behind a minimal injected interface so it can be unit-tested with a fake,
// the same approach as lib/cache.ts.

export const EDGE_EMBEDDING_MODEL = "@cf/baai/bge-m3";

export interface EmbeddingAI {
  run(
    model: string,
    inputs: { text: string | string[] }
  ): Promise<{ data: number[][] }>;
}

export async function getEdgeEmbedding(ai: EmbeddingAI, text: string): Promise<number[]> {
  const result = await ai.run(EDGE_EMBEDDING_MODEL, { text });
  return result.data[0];
}
