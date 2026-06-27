// Persistence helper for a freshly produced translation. Extracted from the
// route so the INSERT (column order / bindings) can be unit-tested with a fake
// DB, the same dependency-injection approach as lib/cache.ts.

import { estimateTokens } from "./utils";
import {
  getEdgeEmbedding,
  EDGE_EMBEDDING_VERSION,
  type EmbeddingAI,
} from "./ai/embedding-edge";

// Minimal slice of the D1 API this helper uses.
export interface InsertDB {
  prepare(query: string): {
    bind(...values: unknown[]): { run(): Promise<unknown> };
  };
}

export interface NewTranslationRow {
  id: string;
  koreanText: string;
  englishText: string;
  model: string;
  style: string;
  embedding: number[] | null;
  createdAt: string;
  // P16 Phase 2: true if this translation used opt-in TM few-shot examples, so
  // the W9 plain cache (findCachedTranslation) can exclude it.
  hadExamples: boolean;
}

const INSERT_SQL = `INSERT INTO translations (id, korean_text, english_text, model, style, embedding, char_count, token_count, created_at, updated_at, had_examples)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

// Persist a new translation row. char_count/token_count are derived here so the
// route doesn't repeat that, and created_at is used for both created/updated.
export async function finalizeTranslation(
  db: InsertDB,
  row: NewTranslationRow
): Promise<void> {
  await db
    .prepare(INSERT_SQL)
    .bind(
      row.id,
      row.koreanText,
      row.englishText,
      row.model,
      row.style,
      row.embedding ? JSON.stringify(row.embedding) : null,
      row.koreanText.length,
      estimateTokens(row.koreanText),
      row.createdAt,
      row.createdAt,
      row.hadExamples ? 1 : 0
    )
    .run();
}

// Minimal slice of the D1 API the background embedding update uses.
export interface UpdateEmbeddingDB {
  prepare(query: string): {
    bind(...values: unknown[]): { run(): Promise<unknown> };
  };
}

const UPDATE_EMBEDDING_SQL = `UPDATE translations
   SET embedding_v2 = ?, embedding_version = ?
   WHERE id = ?`;

// P16 Phase 1: compute a row's bge-m3 edge embedding and store it in
// embedding_v2 (+ version tag), OUT of the translation hot path. The route
// schedules this via ctx.waitUntil after the stream closes, so it never blocks
// the response — this is what removes the old ~1.3s inline-embedding stall.
export async function recordEdgeEmbedding(
  db: UpdateEmbeddingDB,
  ai: EmbeddingAI,
  row: { id: string; text: string }
): Promise<void> {
  const vector = await getEdgeEmbedding(ai, row.text);
  await db
    .prepare(UPDATE_EMBEDDING_SQL)
    .bind(JSON.stringify(vector), EDGE_EMBEDDING_VERSION, row.id)
    .run();
}
