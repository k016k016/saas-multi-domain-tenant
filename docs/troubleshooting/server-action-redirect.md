# Server Actionのredirect()問題

**頻度**: ⭐⭐（このプロジェクトで2回遭遇）

---

## 🐛 症状

Server Actionで`redirect()`に絶対URLを指定しても、`localhost`にリダイレクトされてしまう。

### 具体例

```typescript
// 期待: app.local.test:3000 に遷移
redirect('http://app.local.test:3000/items/123')

// 実際: localhost:3000 に遷移してしまう
```

### エラーメッセージ

特にエラーは出ないが、期待したドメインに遷移しない。E2Eテストではドメインの不一致によりテストが失敗する。

---

## 🔍 根本原因

### 1. Next.jsの最適化

Next.jsは同一オリジン前提の最適化を行い、絶対URLを相対URLに変換することがある。

### 2. dev環境の不安定性

- Hostヘッダの揺れ
- プロキシ設定の影響
- 開発サーバーの内部処理

### 3. Server Action応答ストリーム切断

クライアント側が先にアンマウント（遷移）すると、Server Actionの応答ストリームが途中で切れ、Set-Cookieなどが失われる。

**関連エラー**: `failed to forward action response`

---

## ✅ 解決策

### パターン1: 値を返してクライアント側で遷移（推奨）

```typescript
// Server Action
export async function createItem(data: FormData) {
  // ... 処理

  revalidatePath('/items')
  revalidatePath(`/items/${item.id}`)

  return { success: true, itemId: item.id }
}

// Client Component
const handleSubmit = async () => {
  const result = await createItem(formData)

  if ('error' in result) {
    setError(result.error)
    return
  }

  // ✅ 相対URLで遷移（現在のドメインを維持）
  router.push(`/items/${result.itemId}`)
}
```

**メリット**:
- 現在のドメインが維持される
- E2Eテストが安定する
- エラーハンドリングがしやすい
- ローディング状態の管理が容易

**デメリット**:
- クライアント側のコードが少し増える

---

### パターン2: 同一ドメイン内なら相対パス

```typescript
// 同一ドメイン内の遷移ならOK
redirect('/items/123') // ✅

// 別ドメインへの遷移は避ける
redirect('http://app.local.test:3000/items/123') // ❌
```

**用途**: 同一ドメイン内での単純な遷移

---

### パターン3: E2E環境での特別処理（認証フローのみ）

どうしてもServer Action内でリダイレクトが必要な場合（認証フローなど）：

```typescript
export async function signUp(formData: FormData) {
  // ... サインアップ処理

  // E2E環境では値を返す
  if (process.env.NEXT_PUBLIC_E2E === '1') {
    return {
      success: true,
      requiresEmailConfirmation: false,
    }
  }

  // 本番環境ではredirect()
  redirect('/onboarding/select-plan')
}
```

**用途**: 認証フローなど、Server Action内でredirect()が必須の場合のみ

**注意**: 通常のCRUD操作では使用しないこと

---

## 📚 関連資料

### パターン
- [Server Actionsパターン](../patterns/server-actions.md#1-server-actionではredirectを使わないマルチドメイン環境)
- [マルチドメインパターン](../patterns/multi-domain.md#server-actionでの遷移)（プロジェクト固有）

### 実装例
プロジェクトの実装ログを参照してください。

### ADR（サンプル）
- [ADR-003: E2E認証バイパス](../decisions/003-e2e-auth-bypass.md)

---

## 💡 予防策

### 実装前チェックリスト

- [ ] Server Action実装時に[Server Actionsパターン](../patterns/server-actions.md)を確認
- [ ] redirect()を使わず値を返すパターンを採用
- [ ] マルチドメイン環境での動作を確認

### レビュー時チェックリスト

- [ ] Server Action内に`redirect()`がないか確認
- [ ] 絶対URLで遷移していないか確認
- [ ] E2Eテストでドメインが維持されることを確認

---

## 📊 発生履歴（サンプル）

以下は、実際のプロジェクトで発生した例です：

| 日付 | 状況 | 解決方法 |
|------|------|---------|
| 2025-01-24 | Wiki機能でredirect()問題 | パターン1（値を返す） |
| 2025-10-25 | 認証フローでredirect()問題 | パターン3（E2E特別処理） |

**教訓**: **同じ問題を2回解決した**。最初からパターンカタログを整備していれば、2回目は避けられた。

**注意**: 新しいプロジェクトでは、この表を削除して自分のプロジェクトの履歴を記録してください。

---

このトラブルシューティングにより、**同じ失敗を繰り返さず**、素早く解決できます。
