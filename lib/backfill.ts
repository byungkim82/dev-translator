// P16 Phase 1: one-time backfill of bge-m3 edge embeddings for existing rows.
// Re-embeds rows that have no embedding_v2 yet (in created_at DESC pages) and
// stores the vector + version via the same recordEdgeEmbedding path the hot
// path's background task uses, so the write is identical. Idempotent: each call
// only touches rows still missing embedding_v2, so it's safe to call repeatedly
// until `processed` is 0.

import {
  recordEdgeEmbedding,
  type UpdateEmbeddingDB,
} from "./translate-core";
import type { EmbeddingAI } from "./ai/embedding-edge";

export const BACKFILL_BATCH_SIZE = 50;

interface PendingRow {
  id: string;
  korean_text: string;
}

// The slice of the D1 query API the backfill relies on (select page + update).
export interface BackfillDB extends UpdateEmbeddingDB {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      all<T = unknown>(): Promise<{ results?: T[] }>;
    };
  };
}

const SELECT_PENDING_SQL = `SELECT id, korean_text
   FROM translations
   WHERE embedding_v2 IS NULL
   ORDER BY created_at DESC
   LIMIT ?`;

// Embed one page of rows missing embedding_v2 and persist each. Returns how many
// rows were processed; a return of 0 means the backfill is complete.
export async function backfillEmbeddingBatch(
  db: BackfillDB,
  ai: EmbeddingAI,
  limit: number = BACKFILL_BATCH_SIZE
): Promise<{ processed: number }> {
  const page = await db
    .prepare(SELECT_PENDING_SQL)
    .bind(limit)
    .all<PendingRow>();
  const rows = page.results ?? [];

  for (const row of rows) {
    await recordEdgeEmbedding(db, ai, { id: row.id, text: row.korean_text });
  }

  return { processed: rows.length };
}
