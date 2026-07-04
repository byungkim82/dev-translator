import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { streamGeminiText, cleanGeminiOutput } from "@/lib/ai/gemini";
import { buildReadingPrompt } from "@/lib/prompts";
import { encodeStreamEvent, type StreamEvent } from "@/lib/stream-protocol";

// F11: English → Korean reading mode. EPHEMERAL by design — NO cache, NO
// persistence, NO embedding, NO TM/few-shot. This keeps the KO-centric storage/
// cache/TM machinery completely untouched (see docs/F11-reading-mode-design.md,
// decision C). Reuses the W7 NDJSON streaming protocol as-is (decision E/F).

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

    const { env } = await getCloudflareContext();
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

          // done.english_text carries the final cleaned OUTPUT (Korean here). id and
          // created_at are empty — reading mode persists nothing.
          send({ type: "done", id: "", english_text: cleanGeminiOutput(full), truncated, created_at: "" });
          controller.close();
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
