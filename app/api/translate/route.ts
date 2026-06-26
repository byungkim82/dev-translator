import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { callGemini } from "@/lib/ai/gemini";
import { getEmbedding } from "@/lib/ai/embedding";
import { buildTranslationPrompt, type UserContext } from "@/lib/prompts";
import { generateId, estimateTokens } from "@/lib/utils";
import { findCachedTranslation, normalizeKoreanInput } from "@/lib/cache";
import { selectFewShotExamples, type FewShotExample } from "@/lib/examples";
import type { TranslationWithEmbedding } from "@/lib/similarity";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { koreanText?: string; model?: string; style?: string };
    const { koreanText: rawKoreanText, model, style } = body;
    const resolvedModel = model || "gemini-flash-lite";
    const resolvedStyle = style || "casual-work";

    if (!rawKoreanText || typeof rawKoreanText !== "string") {
      return NextResponse.json(
        { error: "번역할 텍스트가 필요합니다" },
        { status: 400 }
      );
    }

    // Normalize once (trim) so trivially-different whitespace still hits the cache.
    const koreanText = normalizeKoreanInput(rawKoreanText);
    if (!koreanText) {
      return NextResponse.json(
        { error: "번역할 텍스트가 필요합니다" },
        { status: 400 }
      );
    }

    const { env } = await getCloudflareContext();
    const cfEnv = env as CloudflareEnv;

    // W9: exact-match cache. An identical (text, style, model) returns the stored
    // translation instantly — no Gemini/embedding call, no duplicate row. model
    // and style are part of the key, so re-requesting the same Korean with a
    // better model (or a different style) still translates fresh.
    const cached = await findCachedTranslation(
      cfEnv.DB,
      koreanText,
      resolvedStyle,
      resolvedModel
    );
    if (cached) {
      return NextResponse.json({
        id: cached.id,
        korean_text: cached.korean_text,
        english_text: cached.english_text,
        model: cached.model,
        style: cached.style,
        category: cached.category,
        is_favorite: Boolean(cached.is_favorite),
        created_at: cached.created_at,
        cached: true,
        truncated: false,
      });
    }

    if (!cfEnv.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY가 설정되지 않았습니다" },
        { status: 500 }
      );
    }

    // Load user context + glossary from settings
    const settingsRow = await cfEnv.DB.prepare(
      "SELECT user_role, company_size, audience, glossary FROM settings WHERE id = 'default'"
    ).first<UserContext & { glossary?: string }>();
    const userContext: UserContext = settingsRow || {};

    // P14: compute the input embedding once, up front. Used both to find similar
    // past favorited translations (few-shot style examples) and, later, for storage.
    let embedding: number[] | null = null;
    if (cfEnv.OPENAI_API_KEY) {
      try {
        embedding = await getEmbedding(koreanText, cfEnv.OPENAI_API_KEY);
      } catch (e) {
        console.error("Embedding generation failed:", e);
        // Continue without embedding (no examples, no stored vector).
      }
    }

    // P14: personalized few-shot examples from the user's own favorited history.
    // No embedding (e.g. no OpenAI key) or no close favorites => stays empty, so
    // the prompt falls back to the static examples unchanged (zero behavior change).
    let examples: FewShotExample[] = [];
    if (embedding) {
      const favorites = await cfEnv.DB.prepare(
        `SELECT id, korean_text, english_text, embedding, model, style, category, is_favorite, created_at
         FROM translations
         WHERE is_favorite = 1 AND embedding IS NOT NULL
         ORDER BY created_at DESC
         LIMIT 200`
      ).all<TranslationWithEmbedding>();
      examples = selectFewShotExamples(embedding, favorites.results ?? []);
    }

    // Build prompt and translate
    const prompt = buildTranslationPrompt(koreanText, resolvedStyle, userContext, settingsRow?.glossary, examples);
    const { text: englishText, truncated } = await callGemini(prompt, cfEnv.GEMINI_API_KEY, resolvedModel, resolvedStyle);

    // Save to database
    const id = generateId();
    const now = new Date().toISOString();

    await cfEnv.DB.prepare(
      `INSERT INTO translations (id, korean_text, english_text, model, style, embedding, char_count, token_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        koreanText,
        englishText,
        resolvedModel,
        resolvedStyle,
        embedding ? JSON.stringify(embedding) : null,
        koreanText.length,
        estimateTokens(koreanText),
        now,
        now
      )
      .run();

    return NextResponse.json({
      id,
      korean_text: koreanText,
      english_text: englishText,
      model: resolvedModel,
      style: resolvedStyle,
      category: null,
      is_favorite: false,
      created_at: now,
      cached: false,
      truncated,
    });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "번역 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
