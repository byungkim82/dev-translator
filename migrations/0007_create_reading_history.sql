-- EN→KO reading-mode history (F11 follow-up). ISOLATED from the translations
-- table on purpose: keeps the KO→EN cache/TM/stats/history completely untouched
-- (see docs/reading-history-design.md, decision A). A disposable comprehension log.
--
-- Columns are ROLE-based (source/target), NOT language-based, on purpose: the
-- translations table already uses english_text=OUTPUT / korean_text=INPUT, and
-- reusing those names here (with inverted roles) is a known inversion trap. Here
-- source_text = the incoming English (input), target_text = the Korean output.
CREATE TABLE IF NOT EXISTS reading_history (
  id TEXT PRIMARY KEY,
  source_text TEXT NOT NULL,  -- incoming English (input)
  target_text TEXT NOT NULL,  -- Korean output
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reading_history_created_at ON reading_history(created_at DESC);
