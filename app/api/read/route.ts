import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { streamGeminiText, cleanGeminiOutput } from "@/lib/ai/gemini";
import { buildReadingPrompt } from "@/lib/prompts";
import { encodeStreamEvent, type StreamEvent } from "@/lib/stream-protocol";
import { generateId } from "@/lib/utils";
import { insertReadingHistory } from "@/lib/reading-history";

// F11: English → Korean reading mode. NO cache, NO embedding, NO TM/few-shot —
// this keeps the KO-centric storage/cache/TM machinery completely untouched (see
// docs/F11-reading-mode-design.md). Reuses the W7 NDJSON streaming protocol as-is.
// The only persistence is a best-effort log to the ISOLATED reading_history table
// (docs/reading-history-design.md) — the translations table is never touched.

// Reading has no user-facing style; use the dedicated "reading" temperature key
// added to STYLE_TEMPERATURES (0.3), NOT a KO→EN style key (avoids hidden coupling
// to their tuning).
const READING_STYLE = "reading";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { englishText?: string };
    // Reading mode is locked to the cheap/fast default model — the premium model
    // is pointless for comprehension and isn't offered in the reading UI. Hardcoded
    // here (not read from the request) so it can't be bypassed by any client.
    const resolvedModel = "gemini-flash-lite";
    const rawText = body.englishText;

    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return NextResponse.json({ error: "번역할 영어 텍스트가 필요합니다" }, { status: 400 });
    }
    const englishText = rawText.trim();

    const { env, ctx } = await getCloudflareContext();
    const cfEnv = env as CloudflareEnv;
    if (!cfEnv.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다" }, { status: 500 });
    }

    const prompt = buildReadingPrompt(englishText);
    const geminiKey = cfEnv.GEMINI_API_KEY;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: StreamEvent) =>
          controller.enqueue(encoder.encode(encodeStreamEvent(event)));
        try {
          // korean_text is unused by the client in reading mode; sent for protocol
          // shape parity only.
          send({ type: "meta", model: resolvedModel, style: "reading", korean_text: "" });

          let full = "";
          let truncated = false;
          const gen = streamGeminiText(prompt, geminiKey, resolvedModel, READING_STYLE);
          for (;;) {
            const next = await gen.next();
            if (next.done) {
              truncated = next.value.truncated;
              break;
            }
            full += next.value;
            send({ type: "delta", text: next.value });
          }

          const koreanOutput = cleanGeminiOutput(full);

          // done.english_text carries the final cleaned OUTPUT (Korean here). id and
          // created_at stay empty — the client doesn't need the log row's id, and an
          // empty id keeps the reading result's favorite button disabled.
          send({ type: "done", id: "", english_text: koreanOutput, truncated, created_at: "" });
          controller.close();

          // Persist to the ISOLATED reading_history log AFTER closing the stream —
          // OFF the critical path (ctx.waitUntil keeps the worker alive past the
          // response, same as the KO→EN background embedding). Only COMPLETE, non-
          // empty results are logged: a truncated or empty read is skipped to avoid
          // partial-as-complete / empty junk rows. Best-effort — a failed write just
          // means no log. This is the ONLY new write; it never touches translations /
          // W9 cache / TM / embeddings. Role-based columns: source = English input,
          // target = Korean output.
          if (koreanOutput.trim() && !truncated) {
            ctx.waitUntil(
              insertReadingHistory(cfEnv.DB, {
                id: generateId(),
                source_text: englishText,
                target_text: koreanOutput,
                created_at: new Date().toISOString(),
              }).catch((e) => console.error("Reading-history persist failed:", e))
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
    console.error("Reading translation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "번역 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
