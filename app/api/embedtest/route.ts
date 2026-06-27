// TEMPORARY — bge-m3 spot-check (delete after validating, like the W7 spike).
// Embeds the given Korean sentences with Workers AI bge-m3 (and OpenAI
// text-embedding-3-small if the key is set) and returns pairwise cosine
// similarities + rough latency, to verify edge-embedding quality for our Korean
// paraphrase task BEFORE migrating the corpus (design §6 flagged this as
// only-verifiable-by-measuring).
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getEdgeEmbedding, type EmbeddingAI } from "@/lib/ai/embedding-edge";
import { getEmbedding } from "@/lib/ai/embedding";
import { cosineSimilarity } from "@/lib/similarity";

function pairs(texts: string[], vecs: number[][]) {
  const out: { a: string; b: string; cos: number }[] = [];
  for (let i = 0; i < vecs.length; i++) {
    for (let j = i + 1; j < vecs.length; j++) {
      out.push({ a: texts[i], b: texts[j], cos: Number(cosineSimilarity(vecs[i], vecs[j]).toFixed(4)) });
    }
  }
  return out;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { texts?: string[] };
  const texts = (body.texts ?? []).filter((t) => typeof t === "string" && t.trim()).slice(0, 10);
  if (texts.length < 2) {
    return NextResponse.json({ error: "texts: 2~10개의 문장이 필요합니다" }, { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const cfEnv = env as CloudflareEnv;

  // bge-m3 (edge)
  const t0 = Date.now();
  const bge = await Promise.all(
    texts.map((t) => getEdgeEmbedding(cfEnv.AI as unknown as EmbeddingAI, t))
  );
  const bgem3 = { dim: bge[0].length, totalMs: Date.now() - t0, pairs: pairs(texts, bge) };

  // OpenAI (for side-by-side comparison, if configured)
  let openai: { dim: number; totalMs: number; pairs: ReturnType<typeof pairs> } | null = null;
  if (cfEnv.OPENAI_API_KEY) {
    const o0 = Date.now();
    const oa = await Promise.all(texts.map((t) => getEmbedding(t, cfEnv.OPENAI_API_KEY)));
    openai = { dim: oa[0].length, totalMs: Date.now() - o0, pairs: pairs(texts, oa) };
  }

  return NextResponse.json({ texts, bgem3, openai });
}
