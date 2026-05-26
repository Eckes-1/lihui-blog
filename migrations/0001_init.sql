CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug_id TEXT UNIQUE NOT NULL,
  content TEXT DEFAULT '',
  description TEXT DEFAULT '',
  image TEXT DEFAULT '',
  category TEXT DEFAULT '',
  pin_top INTEGER DEFAULT 0,
  draft INTEGER DEFAULT 0,
  pub_date TEXT,
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  parent_id INTEGER,
  username TEXT NOT NULL,
  email TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  content TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  approved INTEGER DEFAULT 0,
  deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS friend_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  url TEXT NOT NULL,
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  size INTEGER DEFAULT 0,
  mime_type TEXT DEFAULT '',
  alt_text TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

CREATE TABLE IF NOT EXISTS media_files (
  id INTEGER PRIMARY KEY,
  data BLOB NOT NULL,
  FOREIGN KEY (id) REFERENCES media(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  method TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

CREATE TABLE IF NOT EXISTS verify_codes (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

INSERT OR IGNORE INTO site_config (key, value) VALUES ('site.title', 'Momo');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('site.subTitle', 'Blog');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('site.favicon', '/favicon/favicon.ico');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('site.pageSize', '6');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('toc.enable', 'true');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('toc.depth', '3');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('blogNavi.enable', 'true');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('comments.enable', 'true');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('comments.platform', 'default');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('comments.backendUrl', '');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('theme.AOS', 'true');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('theme.LQIP', 'true');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('theme.PhotoSwipe', 'true');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('profile.avatar', 'assets/Motues.jpg');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('profile.name', 'Motues');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('profile.description', 'Life is colorful!');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('profile.indexPage', 'https://www.motues.top');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('profile.startYear', '2024');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('license.enable', 'true');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('license.name', 'CC BY-NC-SA 4.0');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('license.url', 'https://creativecommons.org/licenses/by-nc-sa/4.0/');
