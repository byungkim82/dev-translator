// Persistence helper for a freshly produced translation. Extracted from the
// route so the INSERT (column order / bindings) can be unit-tested with a fake
// DB, the same dependency-injection approach as lib/cache.ts.

import { estimateTokens } from "./utils";

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
}

const INSERT_SQL = `INSERT INTO translations (id, korean_text, english_text, model, style, embedding, char_count, token_count, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

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
      row.createdAt
    )
    .run();
}
