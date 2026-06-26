import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { callGemini } from "@/lib/ai/gemini";
import { getEmbedding } from "@/lib/ai/embedding";
import { buildTranslationPrompt, type UserContext } from "@/lib/prompts";
import { generateId, estimateTokens } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { koreanText?: string; model?: string; style?: string };
    const { koreanText, model, style } = body;
    const resolvedModel = model || "gemini-flash-lite";

    if (!koreanText || typeof koreanText !== "string") {
      return NextResponse.json(
        { error: "번역할 텍스트가 필요합니다" },
        { status: 400 }
      );
    }

    const { env } = await getCloudflareContext();
    const cfEnv = env as CloudflareEnv;

    if (!cfEnv.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY가 설정되지 않았습니다" },
        { status: 500 }
      );
    }

    // Load user context from settings
    const settingsRow = await cfEnv.DB.prepare(
      "SELECT user_role, company_size, audience FROM settings WHERE id = 'default'"
    ).first<UserContext>();
    const userContext: UserContext = settingsRow || {};

    // Build prompt and translate
    const prompt = buildTranslationPrompt(koreanText, style || "casual-work", userContext);
    const englishText = await callGemini(prompt, cfEnv.GEMINI_API_KEY, resolvedModel, style || "casual-work");

    // Generate embedding if OpenAI key is available
    let embedding: number[] | null = null;
    if (cfEnv.OPENAI_API_KEY) {
      try {
        embedding = await getEmbedding(koreanText, cfEnv.OPENAI_API_KEY);
      } catch (e) {
        console.error("Embedding generation failed:", e);
        // Continue without embedding
      }
    }

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
        style || "casual-work",
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
      style: style || "casual-work",
      category: null,
      is_favorite: false,
      created_at: now,
    });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "번역 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
