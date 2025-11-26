-- イミュータブルログ（activity_logs）の実装
-- activity_logsテーブルに対してUPDATE/DELETE操作を禁止するトリガーを追加

-- UPDATE防止トリガー関数
CREATE OR REPLACE FUNCTION prevent_activity_logs_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '監査ログは変更できません（activity_logs is immutable）';
END;
$$ LANGUAGE plpgsql;

-- DELETE防止トリガー関数
CREATE OR REPLACE FUNCTION prevent_activity_logs_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '監査ログは削除できません（activity_logs is immutable）';
END;
$$ LANGUAGE plpgsql;

-- UPDATEトリガー
CREATE TRIGGER prevent_activity_logs_update_trigger
  BEFORE UPDATE ON activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_activity_logs_update();

-- DELETEトリガー
CREATE TRIGGER prevent_activity_logs_delete_trigger
  BEFORE DELETE ON activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_activity_logs_delete();

-- テーブルコメント更新（イミュータブル性の明記）
COMMENT ON TABLE activity_logs IS '監査ログテーブル（イミュータブル: INSERT/SELECTのみ可、UPDATE/DELETE不可）';
