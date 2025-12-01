# 通知 / メール送信パターン（@repo/notifications）

このドキュメントでは、通知・メール送信の抽象レイヤーとして用意した `@repo/notifications`
パッケージの使い方と、実プロダクトでの拡張方針をまとめます。

目的は次の2つです。

- どのプロダクトでも共通して使える「通知の型」を用意する
- 実際のメールプロバイダ（SendGrid / Resend / SES など）への接続は各プロダクトで自由に選べるようにする

---

## 提供されるインターフェイス

`packages/notifications/src/index.ts` では、次のような型と関数を提供します。

```ts
export type EmailAddress = string;

export interface MailMessage {
  to: EmailAddress;
  subject: string;
  text?: string;
  html?: string;
  category?: string; // 例: 'invite', 'password_reset', 'generic'
}

export interface NotificationContext {
  orgId?: string;
  userId?: string;
}

export interface NotificationResult {
  success: boolean;
  error?: string;
  providerMessageId?: string;
}

export interface MailSender {
  sendMail(
    message: MailMessage,
    context?: NotificationContext
  ): Promise<NotificationResult>;
}

export function createConsoleMailSender(): MailSender;
```

ポイント:

- **MailMessage**: どのメールプロバイダでもほぼ共通な情報だけを持つ
- **NotificationContext**: orgId / userId など、監査やログに使えるメタ情報を渡すためのコンテキスト
- **MailSender**: 実際の送信処理のインターフェイス。プロバイダごとに実装を差し替える
- **createConsoleMailSender()**: デフォルト実装。実際の送信は行わず、サーバーログに内容を出力するだけ

---

## 雛形での使い方（ローカル / サンプル実装）

雛形段階・ローカル開発では、`createConsoleMailSender()` を直接使えば十分です。

例: ユーザー招待メールを送る Server Action（擬似コード）

```ts
import { createConsoleMailSender } from '@repo/notifications';

export async function inviteUserWithEmail(params: {
  orgId: string;
  currentUserId: string;
  email: string;
}) {
  const mailSender = createConsoleMailSender();

  await mailSender.sendMail(
    {
      to: params.email,
      subject: '招待メール（サンプル）',
      text: 'あなたは組織に招待されました。',
      category: 'invite',
    },
    {
      orgId: params.orgId,
      userId: params.currentUserId,
    }
  );
}
```

この段階では、コンソールにログが出るだけで、実際のメールは飛びません。
本番プロダクトでプロバイダ実装を用意したら、`createConsoleMailSender()` を差し替える形に変更します。

---

## 本番プロダクトでの拡張方針

このスターター自体は、特定のメールプロバイダに依存しません。
実際の送信は、各プロダクト側で `MailSender` を実装して接続します。

### 例: Resend を使う場合（擬似コード）

```ts
import { Resend } from 'resend';
import type { MailSender, MailMessage, NotificationContext, NotificationResult } from '@repo/notifications';

export function createResendMailSender(apiKey: string): MailSender {
  const resend = new Resend(apiKey);

  return {
    async sendMail(message: MailMessage, context?: NotificationContext): Promise<NotificationResult> {
      try {
        const result = await resend.emails.send({
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
          // context や category はヘッダ / カスタム変数などに埋め込む
        });

        return {
          success: true,
          providerMessageId: result.data?.id,
        };
      } catch (error: any) {
        console.error('[notifications] resend error', { error, context });
        return {
          success: false,
          error: error?.message ?? 'Failed to send email',
        };
      }
    },
  };
}
```

### 差し替えの考え方

- **雛形**: `createConsoleMailSender()` を使う（ログ出力のみ）
- **本番**: 環境変数や DI コンテナなどを使って、Resend/SES 版の `MailSender` に差し替える

このとき、アプリ側のコードは `MailSender` インターフェイスだけを見ていればよく、
プロバイダの SDK に直接依存しない構造になります。

---

## このレイヤーに「入れるもの」と「入れないもの」

**入れるもの（共通化したいもの）**

- メール・通知の「型」（`MailMessage`, `NotificationContext`, `NotificationResult`）
- インターフェイス（`MailSender`）
- 雛形としてのデフォルト実装（`createConsoleMailSender()`）

**入れないもの（各プロダクトで決めるもの）**

- 具体的なプロバイダ統合（SendGrid / Resend / SES などの SDK 呼び出し）
- メールテンプレート（HTML / 文面）
- 通知のトリガー条件（どのイベントでどのメールを飛ばすか）

この分割により、「共通で再利用したい基盤（インターフェイスと型）はこのリポジトリに寄せる」が、
「ビジネス側のメール運用戦略」は各プロダクトごとに自由に設計できるようになります。

---

## 関連ドキュメント

- `docs/onboarding/new-product-from-template.md`  
  新しい業務ドメインをこのスターターに載せるときの全体的な流れ
- `docs/operations/activity-logs.md`  
  監査ログの設計。通知のトリガーと監査ログをどう組み合わせるかを決めるときに参照

