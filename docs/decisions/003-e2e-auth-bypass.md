# ADR-003: E2E用認証バイパス機構

> **注意**: これは実際のプロジェクトで下した判断のサンプルです。新しいプロジェクトでは、参考として残すか削除してください。

**日付**: 2025-10-25
**ステータス**: Accepted
**決定者**: プロジェクトチーム

---

## コンテキスト

サインアップ直後のE2Eテストで、Server Action応答ストリーム切断によるCookie同期問題が発生：

- **問題**: サインアップ後、`/onboarding/select-plan`へ遷移すべきところ、認証チェックで`AuthPending`または`/login`にリダイレクトされる
- **根本原因**: Server Actionの応答が完了する前にクライアント側が遷移（アンマウント）し、Set-CookieヘッダーがクライアントCookieに同期されない（`failed to forward action response`エラー）

---

## 検討した選択肢

### 選択肢1: クライアント側で複雑な遷移制御を実装

**アプローチ**: Server Actionの応答を完全に待ってから遷移

**メリット**:
- 本番環境と同じフローを使用
- テスト専用コードが不要

**デメリット**:
- 不安定（タイミング依存）
- クライアント側のコードが複雑化
- E2Eテストが頻繁に失敗

---

### 選択肢2: E2E専用の認証バイパス機構を実装

**アプローチ**: テスト専用のエンドポイント（`/testhelpers/dev-login`）でCookieを直接設定

**メリット**:
- E2Eテストが安定
- Cookie同期問題を完全に回避
- テストが高速化

**デメリット**:
- テスト専用コードが増える
- 本番環境との乖離
- セキュリティリスク（適切な保護が必要）

---

### 選択肢3: 両立アプローチ（採用）

**アプローチ**: E2Eはバイパス、本番はServer Action redirect()

```typescript
// Server Action
if (process.env.NEXT_PUBLIC_E2E === '1') {
  return { success: true, requiresEmailConfirmation: false }
}
redirect('/onboarding/select-plan')
```

```typescript
// Client
const result = await signUp(formData)
if (process.env.NEXT_PUBLIC_E2E === '1' && result.success) {
  await fetch('/testhelpers/dev-login', { method: 'POST', body: { secret } })
  router.push('/onboarding/select-plan')
}
```

**メリット**:
- E2Eテストが安定
- 本番環境では正規のフローを使用
- セキュリティを保ちつつテスト効率を向上

**デメリット**:
- 環境別の分岐が必要
- テスト専用コードの保守

---

## 決定内容

**選択肢3: 両立アプローチ**を採用する。

### 理由

1. **E2Eテストの安定性**: Cookie同期問題を確実に回避
2. **本番環境の信頼性**: 正規の認証フローを維持
3. **セキュリティ**: 3重のガード（環境チェック、E2Eフラグ、シークレット検証）
4. **保守性**: E2E専用コードは明確に分離

---

## 実装の詳細

### 1. E2E専用エンドポイント

```typescript
// src/app/testhelpers/dev-login/route.ts
export async function POST(req: Request) {
  // 環境ガード1: 本番環境では404
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 })
  }

  // 環境ガード2: E2Eフラグチェック
  if (process.env.NEXT_PUBLIC_E2E !== '1') {
    return new Response('Not found', { status: 404 })
  }

  // 環境ガード3: シークレット検証
  const { secret } = await req.json()
  if (secret !== process.env.TEST_HELPER_SECRET) {
    return new Response('Forbidden', { status: 403 })
  }

  // E2E専用の擬似認証Cookieを設定
  cookies().set({
    name: 'e2e_auth',
    value: '1',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    domain: '.local.test',
    maxAge: 60 * 30, // 30分
  })

  return NextResponse.json({ ok: true })
}
```

### 2. Middlewareで素通し

```typescript
if (request.nextUrl.pathname.startsWith('/testhelpers/')) {
  return NextResponse.next()
}
```

### 3. RSC側のバイパス

```typescript
if (process.env.NODE_ENV !== 'production') {
  const e2eAuth = cookies().get('e2e_auth')?.value === '1'
  if (e2eAuth) {
    return <div>{children}</div> // 認証チェックをスキップ
  }
}
```

---

## 結果

### メリット

- ✅ E2Eテストが安定（Cookie同期問題を解消）
- ✅ 本番環境では正規の認証フロー
- ✅ 3重のセキュリティガード
- ✅ Cookie有効期限30分、HTTPOnly、SameSite=lax

### デメリット

- ❌ 環境別の分岐コードが増える
- ❌ テスト専用エンドポイントの保守が必要

### トレードオフ

- **E2Eの安定性 vs コードの複雑性**: E2Eテストの安定性を優先し、環境別分岐を許容
- **本番との乖離 vs テスト効率**: 認証フローのみ特別扱いし、他は本番と同じフローを使用

---

## セキュリティ対策

1. **3重のガード**:
   - `NODE_ENV === 'production'` チェック
   - `NEXT_PUBLIC_E2E === '1'` チェック
   - `TEST_HELPER_SECRET` 検証

2. **本番完全無効化**:
   - 本番環境では404を返す
   - E2Eフラグがない環境でも404

3. **最小権限の原則**:
   - Cookie有効期限: 30分
   - HTTPOnly、SameSite=lax設定
   - ドメイン制限

---

## 関連資料

- [実装ログ](../../docs/implementation-logs/2025-10/2025-10-25.md)
- [Server Actionsパターン](../patterns/server-actions.md#6-e2e環境での特別処理認証フローの場合のみ)
- [トラブルシューティング](../troubleshooting/server-action-redirect.md)

---

この決定により、**E2Eテストの安定性と本番環境の信頼性を両立**できました。
