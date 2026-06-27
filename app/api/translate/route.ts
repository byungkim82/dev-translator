import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { streamGeminiText, cleanGeminiOutput } from "@/lib/ai/gemini";
import { buildTranslationPrompt, type UserContext } from "@/lib/prompts";
import { generateId } from "@/lib/utils";
import { findCachedTranslation, normalizeKoreanInput } from "@/lib/cache";
import { encodeStreamEvent, type StreamEvent } from "@/lib/stream-protocol";
import { finalizeTranslation, recordEdgeEmbedding } from "@/lib/translate-core";
import { fetchExamplesByIds, type FewShotExample } from "@/lib/examples";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { koreanText?: string; model?: string; style?: string; exampleIds?: unknown };
    const { koreanText: rawKoreanText, model, style } = body;
    const resolvedModel = model || "gemini-flash-lite";
    const resolvedStyle = style || "casual-work";

    // P16 Phase 2: opt-in TM few-shot example ids selected in the as-you-type
    // panel. Absent/empty => plain request, behaving exactly as Phase 1.
    const exampleIds = Array.isArray(body.exampleIds)
      ? body.exampleIds.filter((x): x is string => typeof x === "string")
      : [];
    const hasExamples = exampleIds.length > 0;

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

    const { env, ctx } = await getCloudflareContext();
    const cfEnv = env as CloudflareEnv;

    // W9: exact-match cache. An identical (text, style, model) returns the stored
    // translation instantly — no Gemini/embedding call, no duplicate row. model
    // and style are part of the key, so re-requesting the same Korean with a
    // better model (or a different style) still translates fresh.
    // P16 Phase 2: example requests skip the cache entirely (force-fresh) — the
    // few-shot examples are meant to re-shape the output, and findCachedTranslation
    // only returns plain (had_examples=0) rows anyway.
    if (!hasExamples) {
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

    // P16 Phase 2: personalized few-shot examples from the user's opt-in TM panel
    // selections. Looked up BY ID (no embedding on the hot path — Phase 1's whole
    // point). Best-effort: a lookup failure (or no ids) leaves examples empty, so
    // the prompt falls back to the static examples unchanged (no regression).
    let examples: FewShotExample[] = [];
    if (hasExamples) {
      try {
        examples = await fetchExamplesByIds(cfEnv.DB, exampleIds);
      } catch (e) {
        console.error("Example lookup failed:", e);
      }
    }

    const prompt = buildTranslationPrompt(koreanText, resolvedStyle, userContext, settingsRow?.glossary, examples);
    const id = generateId();
    const now = new Date().toISOString();
    const geminiKey = cfEnv.GEMINI_API_KEY;
    const db = cfEnv.DB;
    const ai = cfEnv.AI;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: StreamEvent) =>
          controller.enqueue(encoder.encode(encodeStreamEvent(event)));
        try {
          send({ type: "meta", model: resolvedModel, style: resolvedStyle, korean_text: koreanText });

          let full = "";
          let truncated = false;
          const gen = streamGeminiText(prompt, geminiKey, resolvedModel, resolvedStyle);
          for (;;) {
            const next = await gen.next();
            if (next.done) {
              truncated = next.value.truncated;
              break;
            }
            full += next.value;
            send({ type: "delta", text: next.value });
          }

          const englishText = cleanGeminiOutput(full);
          // Persist after the full text is known, before closing the stream. The
          // vector column starts null and is filled by the background task below.
          await finalizeTranslation(db, {
            id,
            koreanText,
            englishText,
            model: resolvedModel,
            style: resolvedStyle,
            embedding: null,
            createdAt: now,
            hadExamples: hasExamples,
          });

          send({ type: "done", id, english_text: englishText, truncated, created_at: now });
          controller.close();

          // Record the bge-m3 embedding off the hot path: ctx.waitUntil keeps the
          // worker alive past the response so this never delays the translation.
          // Best-effort — on failure the row just keeps a null vector and the
          // backfill can pick it up later.
          if (ai) {
            ctx.waitUntil(
              recordEdgeEmbedding(db, ai, { id, text: koreanText }).catch((e) => {
                console.error("Background embedding failed:", e);
              })
            );
          }
        } catch (err) {
          // The HTTP status is already 200, so surface mid-stream failures in-band.
          send({
            type: "error",
            message: err instanceof Error ? err.message : "번역 중 오류가 발생했습니다",
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Content-Encoding": "identity",
      },
    });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "번역 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
