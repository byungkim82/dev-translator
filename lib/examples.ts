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
