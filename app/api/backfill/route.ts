import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { backfillEmbeddingBatch } from "@/lib/backfill";

// P16 Phase 1: one-time backfill of bge-m3 edge embeddings for existing rows.
// Behind Cloudflare Access like the rest of the app. Processes one page per call
// and reports how many rows still lack a vector, so it can be invoked repeatedly
// until `remaining` is 0. Idempotent — only touches rows missing embedding_v2.
export async function POST() {
  try {
    const { env } = await getCloudflareContext();
    const cfEnv = env as CloudflareEnv;

    if (!cfEnv.AI) {
      return NextResponse.json(
        { error: "AI 바인딩이 설정되지 않았습니다" },
        { status: 500 }
      );
    }

    const { processed } = await backfillEmbeddingBatch(cfEnv.DB, cfEnv.AI);

    const remainingRow = await cfEnv.DB.prepare(
      "SELECT COUNT(*) AS n FROM translations WHERE embedding_v2 IS NULL"
    ).first<{ n: number }>();

    return NextResponse.json({
      processed,
      remaining: remainingRow?.n ?? 0,
    });
  } catch (error) {
    console.error("Backfill error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "백필 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
