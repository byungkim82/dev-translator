// Exact-match translation cache (W9). Kept dependency-light: the DB is passed in
// as a minimal interface so the lookup can be unit-tested with a fake.

export interface CachedTranslation {
  id: string;
  korean_text: string;
  english_text: string;
  model: string;
  style: string;
  category: string | null;
  is_favorite: number;
  created_at: string;
}

// The slice of the D1 query API this module relies on.
export interface CacheDB {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first(): Promise<CachedTranslation | null>;
    };
  };
}

// Trim-only normalization so trivially-different surrounding whitespace maps to
// the same cache entry. Internal whitespace is left untouched.
export function normalizeKoreanInput(text: string): string {
  return text.trim();
}

const LOOKUP_SQL = `SELECT id, korean_text, english_text, model, style, category, is_favorite, created_at
   FROM translations
   WHERE korean_text = ? AND style = ? AND model = ?
   ORDER BY created_at DESC
   LIMIT 1`;

// Returns the stored translation for an identical (text, style, model), or null.
// model and style are part of the key on purpose: switching to a better model
// (or a different style) misses the cache and produces a fresh translation.
export async function findCachedTranslation(
  db: CacheDB,
  koreanText: string,
  style: string,
  model: string
): Promise<CachedTranslation | null> {
  const normalized = normalizeKoreanInput(koreanText);
  return db.prepare(LOOKUP_SQL).bind(normalized, style, model).first();
}
