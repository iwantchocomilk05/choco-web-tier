CREATE TABLE IF NOT EXISTS webtoons (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  genre TEXT,
  tier TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  image_url TEXT,
  note TEXT,
  review_reason TEXT,
  like_count INTEGER NOT NULL DEFAULT 0,
  dislike_count INTEGER NOT NULL DEFAULT 0,
  comments_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
