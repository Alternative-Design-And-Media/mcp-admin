-- Users table: one row per Google Workspace user
CREATE TABLE IF NOT EXISTS users (
  email       TEXT PRIMARY KEY,
  display_name TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,  -- 1 = active, 0 = disabled
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  last_login  TEXT
);

-- Tool permissions: which tools a user can access
CREATE TABLE IF NOT EXISTS user_tool_permissions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  tool_name  TEXT NOT NULL,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(email, tool_name)
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_permissions_email ON user_tool_permissions(email);
-- Index for fast per-tool lookups
CREATE INDEX IF NOT EXISTS idx_permissions_tool  ON user_tool_permissions(tool_name);
