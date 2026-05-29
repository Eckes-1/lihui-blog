CREATE TABLE IF NOT EXISTS music (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  artist TEXT DEFAULT '',
  filename TEXT DEFAULT '',
  path TEXT DEFAULT '',
  size INTEGER DEFAULT 0,
  mime_type TEXT DEFAULT 'audio/mpeg',
  duration REAL DEFAULT 0,
  cover_path TEXT DEFAULT '',
  source TEXT DEFAULT 'upload',
  external_url TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

CREATE TABLE IF NOT EXISTS music_chunks (
  music_id INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (music_id, chunk_index),
  FOREIGN KEY (music_id) REFERENCES music(id) ON DELETE CASCADE
);