import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getEmbedding } from "@/lib/ai/embedding";
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

    if (!cfEnv.OPENAI_API_KEY) {
      // No OpenAI key, can't do similarity search
      return NextResponse.json({ similar: [] });
    }

    // Get embedding for query text
    const queryEmbedding = await getEmbedding(text, cfEnv.OPENAI_API_KEY);

    // Get all translations with embeddings
    const result = await cfEnv.DB.prepare(
      `SELECT id, korean_text, english_text, embedding, model, style, category, is_favorite, created_at
       FROM translations
       WHERE embedding IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1000`
    ).all<TranslationWithEmbedding>();

    if (!result.results || result.results.length === 0) {
      return NextResponse.json({ similar: [] });
    }

    // Find similar translations
    const similar = findSimilarTranslations(queryEmbedding, result.results);

    return NextResponse.json({ similar });
  } catch (error) {
    console.error("Similar search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "유사 검색 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
