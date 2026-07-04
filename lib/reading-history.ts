// EN→KO reading-mode history (F11 follow-up). Isolated from the translations
// table so the KO→EN cache/TM/stats/history stay untouched. DB injected as a
// minimal interface for unit testing (same approach as lib/cache.ts).
//
// Role-based fields (source/target), NOT language names — see the migration
// comment and design decision J. source = incoming English, target = Korean.

export interface ReadingHistoryRow {
  id: string;
  source_text: string; // incoming English (input)
  target_text: string; // Korean output
  created_at: string;
}

// The slice of the D1 query API this module relies on (injected for tests).
export interface ReadingInsertDB {
  prepare(query: string): {
    bind(...values: unknown[]): { run(): Promise<unknown> };
  };
}

const INSERT_SQL = `INSERT INTO reading_history (id, source_text, target_text, created_at)
   VALUES (?, ?, ?, ?)`;

export async function insertReadingHistory(
  db: ReadingInsertDB,
  row: ReadingHistoryRow
): Promise<void> {
  await db
    .prepare(INSERT_SQL)
    .bind(row.id, row.source_text, row.target_text, row.created_at)
    .run();
}
