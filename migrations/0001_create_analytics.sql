-- アクセスカウントテーブル
CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_path TEXT NOT NULL UNIQUE,
  view_count INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初期データ（トップページ）
INSERT OR IGNORE INTO page_views (page_path, view_count, unique_visitors) 
VALUES ('/', 0, 0);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_page_path ON page_views(page_path);
