// P14: reuse the user's own favorited past translations as personalized few-shot
// examples, so the model mimics the voice the user has already approved. Built on
// the existing embedding/similarity machinery (lib/similarity.ts) — no new tables.

import { findSimilarTranslations, type TranslationWithEmbedding } from "./similarity";
import { EDGE_SIMILARITY_THRESHOLD } from "./ai/embedding-edge";

export interface FewShotExample {
  korean: string;
  english: string;
}

// P16 §8 recalibration: examples select on the same bge-m3 cut-off as TM/similar
// (0.68). The old 0.75/0.85 thresholds were tuned for OpenAI and too high for
// bge-m3 — real paraphrases barely matched. Single source of truth in
// embedding-edge so the model and its threshold stay together.
export const EXAMPLE_SIMILARITY_THRESHOLD = EDGE_SIMILARITY_THRESHOLD;
export const EXAMPLE_LIMIT = 3;

// Pick the most similar PAST favorited translations (decision ①: favorited only)
// to the query embedding, capped at `limit` (decision ②). Favorited filtering is
// done here so the policy is self-contained and unit-testable, even if the caller
// also pre-filters in SQL.
export function selectFewShotExamples(
  queryEmbedding: number[],
  candidates: TranslationWithEmbedding[],
  threshold: number = EXAMPLE_SIMILARITY_THRESHOLD,
  limit: number = EXAMPLE_LIMIT
): FewShotExample[] {
  const favorited = candidates.filter((c) => c.is_favorite === 1);
  const similar = findSimilarTranslations(queryEmbedding, favorited, threshold, limit);
  return similar.map((s) => ({ korean: s.korean_text, english: s.english_text }));
}

// Format selected examples as a prompt block. Empty => "" so the prompt is
// unchanged when there are no relevant past translations (cold-start no-op).
export function buildExamplesLine(examples: FewShotExample[]): string {
  if (examples.length === 0) return "";
  const lines = examples.map((e) => `- ${e.korean} → ${e.english}`).join("\n");
  return `\nHere is how you've translated similar messages before — match this voice:\n${lines}\n`;
}

// The slice of the D1 query API fetchExamplesByIds relies on (injected for tests).
export interface ExamplesDB {
  prepare(query: string): {
    bind(...values: unknown[]): {
      all<T = unknown>(): Promise<{ results?: T[] }>;
    };
  };
}

interface ExampleRow {
  id: string;
  korean_text: string;
  english_text: string;
}

// P16 Phase 2: fetch specific past translations BY ID — the user's opt-in TM
// selections from the as-you-type panel — and format them as few-shot examples.
// No embedding: the ids are already known, so this stays off the hot path's
// latency budget. Capped at `limit` to bound prompt size; ids should arrive in
// similarity order (strongest first) so the cap keeps the best, and the result
// is re-sorted to the input id order since SQL `IN` does not preserve it.
export async function fetchExamplesByIds(
  db: ExamplesDB,
  ids: string[],
  limit: number = EXAMPLE_LIMIT
): Promise<FewShotExample[]> {
  const capped = ids.slice(0, limit);
  if (capped.length === 0) return [];

  const placeholders = capped.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `SELECT id, korean_text, english_text FROM translations WHERE id IN (${placeholders})`
    )
    .bind(...capped)
    .all<ExampleRow>();

  const byId = new Map((result.results ?? []).map((r) => [r.id, r]));
  return capped
    .map((id) => byId.get(id))
    .filter((r): r is ExampleRow => Boolean(r))
    .map((r) => ({ korean: r.korean_text, english: r.english_text }));
}
