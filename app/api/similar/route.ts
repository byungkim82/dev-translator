import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  getEdgeEmbedding,
  EDGE_EMBEDDING_VERSION,
  EDGE_SIMILARITY_THRESHOLD,
} from "@/lib/ai/embedding-edge";
import { findSimilarTranslations, type TranslationWithEmbedding } from "@/lib/similarity";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { text?: string };
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "텍스트가 필요합니다" },
        { status: 400 }
      );
    }

    const { env } = await getCloudflareContext();
    const cfEnv = env as CloudflareEnv;

    if (!cfEnv.AI) {
      // No Workers AI binding, can't embed the query.
      return NextResponse.json({ similar: [] });
    }

    // P16: embed the query with bge-m3 (edge), to compare against bge-m3 vectors.
    const queryEmbedding = await getEdgeEmbedding(cfEnv.AI, text);

    // Only compare against bge-m3 vectors (embedding_v2), gated by version so a
    // different model's vectors are never mixed in. Alias embedding_v2 to
    // `embedding` so findSimilarTranslations reads it unchanged.
    const result = await cfEnv.DB.prepare(
      `SELECT id, korean_text, english_text, embedding_v2 AS embedding, model, style, category, is_favorite, created_at
       FROM translations
       WHERE embedding_version = ? AND embedding_v2 IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1000`
    ).bind(EDGE_EMBEDDING_VERSION).all<TranslationWithEmbedding>();

    if (!result.results || result.results.length === 0) {
      return NextResponse.json({ similar: [] });
    }

    // Find similar translations, using the recalibrated bge-m3 threshold (0.68).
    const similar = findSimilarTranslations(
      queryEmbedding,
      result.results,
      EDGE_SIMILARITY_THRESHOLD
    );

    return NextResponse.json({ similar });
  } catch (error) {
    console.error("Similar search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "유사 검색 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
