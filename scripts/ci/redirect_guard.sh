#!/usr/bin/env bash
set -euo pipefail

# 'use server'を含むファイルを取得
violations=$(rg -n --glob "apps/**/{app,src}/**/*.ts*" -S "'use server'" | cut -d: -f1 | sort -u | while read -r f; do
  # importステートメントでredirectがインポートされているかチェック
  if rg -n "^import.*\{\s*.*redirect.*\}.*from.*['\"]next/navigation['\"]" "$f" -S > /dev/null; then
    echo "$f"
  fi
done)

if [ -n "$violations" ]; then
  echo "[NG] Server Action内で redirect のimportが検出されました:"
  echo "$violations"
  exit 1
fi

echo "[OK] Redirect guard passed"
