#!/bin/bash
# ============================================================
# E2E Test Setup: Run All Seeds
# ============================================================
# 前提:
#  - SUPABASE_DB_URL 環境変数が設定されていること
#  - または .env.test に SUPABASE_DB_URL が定義されていること
#  - psql コマンドが利用可能であること
#
# 使い方:
#   chmod +x infra/supabase/seeds/run-seeds.sh
#   ./infra/supabase/seeds/run-seeds.sh
# ============================================================

set -e  # エラーで停止

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# .env.test から環境変数を読み込み
if [ -f "$ROOT_DIR/.env.test" ]; then
  echo "Loading environment from .env.test..."
  export $(grep -v '^#' "$ROOT_DIR/.env.test" | xargs)
fi

# SUPABASE_DB_URL の確認
if [ -z "$SUPABASE_DB_URL" ]; then
  echo "Error: SUPABASE_DB_URL is not set."
  echo "Please set it in .env.test or as an environment variable."
  echo ""
  echo "Example:"
  echo "  SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"
  exit 1
fi

echo "=================================="
echo "E2E Test Setup: Running Seeds"
echo "=================================="
echo ""

# 1. Check schema
echo "[1/3] Running schema check (01_check.sql)..."
psql "$SUPABASE_DB_URL" -f "$SCRIPT_DIR/01_check.sql"
echo ""

# 2. Apply patches
echo "[2/3] Applying schema patches (02_patch.sql)..."
psql "$SUPABASE_DB_URL" -f "$SCRIPT_DIR/02_patch.sql"
echo ""

# 3. Seed test data
echo "[3/3] Seeding test data (03_dev_seed.sql)..."
psql "$SUPABASE_DB_URL" -f "$SCRIPT_DIR/03_dev_seed.sql"
echo ""

echo "=================================="
echo "✅ All seeds completed successfully!"
echo "=================================="
