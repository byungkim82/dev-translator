-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  default_model TEXT DEFAULT 'gemini-flash',
  default_style TEXT DEFAULT 'casual-work',
  auto_copy INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Insert default settings
INSERT OR IGNORE INTO settings (id) VALUES ('default');
