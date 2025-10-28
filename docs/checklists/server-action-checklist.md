# Server Action 実装チェックリスト

Server Actionを実装する際に、このチェックリストを使用してください。

**所要時間**: 5分
**効果**: バグ削減、セキュリティ向上、保守性向上

---

## ✅ 実装前

- [ ] [Server Actionsパターン](../patterns/server-actions.md)を読んだ
- [ ] 返り値の型を設計した
- [ ] Zodスキーマを準備した
- [ ] マルチドメイン環境での遷移方法を決めた

---

## 🔧 実装中

### 1. 型定義

- [ ] 返り値の型が定義されている
  ```typescript
  export type ActionResult<T> =
    | { success: true; data?: T; nextUrl?: string }
    | { success: false; error: string; nextUrl?: string }
  ```
- [ ] 型に`success`フィールドがある（クライアント側の分岐に使用）
- [ ] `nextUrl`は相対パスまたはフルURL（マルチドメイン対応）

### 2. 入力検証

- [ ] Zodスキーマで入力を検証している
  ```typescript
  const validation = validateFormData(schema, formData)
  if (!validation.success) return { success: false, error: validation.error }
  ```
- [ ] バリデーションエラーメッセージが日本語で分かりやすい
- [ ] **重要**: エラーメッセージはUIに直接表示されるため、適切な内容・表現になっている

### 3. 認証・認可

- [ ] 認証チェックを**最初に**行っている
  ```typescript
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '未認証です' }
  ```
- [ ] 組織コンテキストを取得している
  ```typescript
  const orgId = await getCurrentOrganizationId()
  if (!orgId) return { success: false, error: '組織が選択されていません' }
  ```
- [ ] 必要に応じて権限チェックをしている

### 4. データベース操作

- [ ] `organization_id`でフィルタしている（RLSと併用）
  ```typescript
  .eq('organization_id', orgId)
  ```
- [ ] エラーハンドリングをしている
  ```typescript
  if (error) {
    console.error('[actionName]', error)
    return { success: false, error: '操作に失敗しました' }
  }
  ```

### 5. マルチドメイン対応

- [ ] `redirect()`を一切使っていない（全面禁止）
  ```typescript
  return { success: true, itemId: item.id, nextUrl: '/path' }
  ```
- [ ] 例外は一切ない。同一ドメイン内でも`redirect()`は禁止
  ```typescript
  // ❌ 禁止: redirect('/path')
  // ✅ 正解: return { success: true, nextUrl: '/path' }
  ```
- [ ] `nextUrl`は相対パスまたはフルURL（マルチドメイン対応）
  ```typescript
  // 相対パス: '/dashboard'
  // フルURL: 'http://<ADMIN_DOMAIN>:3000/dashboard'
  ```
- [ ] **重要**: Server Actionは`nextUrl`を返すだけで、`redirect()`は呼ばない
- [ ] クライアント側は`nextUrl`を受け取り、`router.push()`または`location.assign()`で遷移する

### 6. キャッシュ再検証

- [ ] `revalidatePath()`で関連ページを再検証している
  ```typescript
  revalidatePath('/items')
  revalidatePath(`/items/${item.id}`)
  ```

---

## 🧪 テスト

- [ ] E2Eテストでカバーしている
- [ ] 成功ケースをテストしている
- [ ] エラーケースをテストしている（認証エラー、バリデーションエラーなど）
- [ ] 戻り値オブジェクトのshape（success/error/nextUrlなど）が仕様通りであることを検証している
- [ ] マルチドメイン環境で正しいドメインに遷移することを確認している

---

## 📝 ドキュメント

- [ ] 実装ログに記録した
- [ ] 新しいパターンを発見した場合、パターンカタログを更新した

---

## 🎯 完了後の確認

### コードレビュー（セルフチェック）

```typescript
export async function myAction(data: FormData) {
  // ✅ 1. 入力検証
  const validation = validateFormData(schema, data)
  if (!validation.success) return { success: false, error: validation.error }

  // ✅ 2. 認証チェック
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '未認証です' }

  // ✅ 3. 組織コンテキスト
  const orgId = await getCurrentOrganizationId()
  if (!orgId) return { success: false, error: '組織が選択されていません' }

  // ✅ 4. DB操作（organization_idでフィルタ）
  const { data: result, error } = await supabase
    .from('table')
    .insert({ ...validation.data, organization_id: orgId })

  if (error) {
    console.error('[myAction]', error)
    return { success: false, error: '操作に失敗しました' }
  }

  // ✅ 5. キャッシュ再検証
  revalidatePath('/path')

  // ✅ 6. 値を返す（redirect()は全面禁止）
  return { success: true, data: result, nextUrl: '/dashboard' }
}
```

---

## 💡 よくある質問

### Q: エラーメッセージはどう扱うべきか？

A: エラーメッセージは`error: string`として返し、UIに直接表示される前提で設計してください。具体的には：
- 日本語で分かりやすい表現を使用（例：「未認証です」「組織が選択されていません」）
- セキュリティ上問題ない内容（内部エラー詳細を露出しない）
- 将来のCS/サポート対応を考慮した内容

### Q: redirect()を絶対に使ってはいけないのか？

A: **全面禁止**です。同一ドメイン内でも`redirect()`は使用禁止。Server Actionは「状態更新と結果を返す」まで。実際の画面遷移はクライアント側で`router.push()`を使用してください。

### Q: revalidatePath()を忘れるとどうなるのか？

A: Next.jsのキャッシュが更新されず、ユーザーに古いデータが表示されます。データ作成・更新・削除の後は**必ず**関連パスを再検証してください。

### Q: organization_idのチェックはRLSで十分ではないのか？

A: RLSとアプリケーションレベルのチェックの**両方**が必要です（多層防御）。RLSがあるからといって、アプリケーションレベルのチェックを省略してはいけません。

---

このチェックリストを使うことで、**高品質で安全なServer Action**を実装できます。
