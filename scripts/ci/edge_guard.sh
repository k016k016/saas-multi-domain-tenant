#!/usr/bin/env bash
set -euo pipefail

# middleware.ts で next/headers を使っていないか
if rg -n --glob "apps/**/middleware.ts" "from\s+['\"]next/headers['\"]" -S; then
  echo "[NG] middlewareで next/headers を使用しています"; exit 1
fi

# middleware.ts で @repo/db をimportしていないか
if rg -n --glob "apps/**/middleware.ts" "from\s+['\"]@repo/db['\"]" -S; then
  echo "[NG] middlewareで @repo/db をimportしています"; exit 1
fi

echo "[OK] Edge guard passed"
