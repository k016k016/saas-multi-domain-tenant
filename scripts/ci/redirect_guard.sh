#!/usr/bin/env bash
set -euo pipefail

violations=$(rg -n --glob "apps/**/{app,src}/**/*.ts*" -S "'use server'" | cut -d: -f1 | sort -u | while read -r f; do
  if rg -n "redirect\s*\(" "$f" -S > /dev/null; then
    echo "$f"
  fi
done)

if [ -n "$violations" ]; then
  echo "[NG] Server Action内で redirect() が使われています:"
  echo "$violations"
  exit 1
fi

echo "[OK] Redirect guard passed"
