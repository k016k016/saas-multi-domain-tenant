#!/usr/bin/env bash
set -euo pipefail

# Load .env.test
source .env.test

echo "🔐 E2Eテストユーザーのパスワードをリセット中..."
echo ""

for email in "member1@example.com" "admin1@example.com" "owner1@example.com"; do
  # Get user ID
  user_id=$(curl -s "${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" | \
    jq -r ".users[] | select(.email == \"$email\") | .id")

  if [ -n "$user_id" ] && [ "$user_id" != "null" ]; then
    # Update password
    curl -s -X PUT "${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${user_id}" \
      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"password\": \"${E2E_TEST_PASSWORD}\"}" > /dev/null
    echo "✅ $email: パスワード更新完了"
  else
    echo "⚠️  $email: ユーザーが見つかりません"
  fi
done

echo ""
echo "✨ 完了"
