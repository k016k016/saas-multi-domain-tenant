-- 監査ログ拡充: メタデータフィールド追加
-- request_id, session_id, ip_address, user_agent, severity を追加

-- 新規カラム追加（NULL許可で後方互換性維持）
ALTER TABLE activity_logs
  ADD COLUMN request_id UUID,
  ADD COLUMN session_id UUID,
  ADD COLUMN ip_address TEXT,
  ADD COLUMN user_agent TEXT,
  ADD COLUMN severity TEXT DEFAULT 'info' NOT NULL;

-- インデックス追加（クエリ高速化）
CREATE INDEX idx_activity_logs_request_id ON activity_logs(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX idx_activity_logs_session_id ON activity_logs(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_activity_logs_severity ON activity_logs(severity);

-- テーブルコメント更新
COMMENT ON COLUMN activity_logs.request_id IS 'リクエストID（分散トレーシング用）';
COMMENT ON COLUMN activity_logs.session_id IS 'Supabaseセッション識別子';
COMMENT ON COLUMN activity_logs.ip_address IS 'クライアントIPアドレス';
COMMENT ON COLUMN activity_logs.user_agent IS 'User-Agentヘッダ';
COMMENT ON COLUMN activity_logs.severity IS 'ログレベル: info, warning, critical';
