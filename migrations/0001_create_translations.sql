-- Create translations table
CREATE TABLE IF NOT EXISTS translations (
  id TEXT PRIMARY KEY,
  korean_text TEXT NOT NULL,
  english_text TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gemini-flash',
  style TEXT NOT NULL DEFAULT 'casual-work',
  category TEXT,
  embedding TEXT,
  is_favorite INTEGER DEFAULT 0,
  char_count INTEGER,
  token_count INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_translations_created_at ON translations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_translations_category ON translations(category);
CREATE INDEX IF NOT EXISTS idx_translations_is_favorite ON translations(is_favorite);
CREATE INDEX IF NOT EXISTS idx_translations_style ON translations(style);
