-- Optional D1 schema for future migration from JSON file storage
CREATE TABLE IF NOT EXISTS webtoons (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  genre TEXT,
  tier TEXT NOT NULL,
  score REAL NOT NULL,
  image_url TEXT,
  note TEXT,
  review_reason TEXT,
  like_count INTEGER NOT NULL DEFAULT 0,
  dislike_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  webtoon_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  like_count INTEGER NOT NULL DEFAULT 0,
  is_admin INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (webtoon_id) REFERENCES webtoons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS replies (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);
