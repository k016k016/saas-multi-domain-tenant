/**
 * 通知 / メール送信の抽象レイヤー
 *
 * このパッケージは「インターフェイス」と「デフォルト実装（コンソール出力のみ）」だけを提供します。
 * 実際のメールプロバイダ（SendGrid / Resend / SES など）との統合は、各プロダクト側で
 * MailSender インターフェイスを実装して差し替える想定です。
 */

export type EmailAddress = string;

/**
 * メールメッセージの共通フォーマット
 */
export interface MailMessage {
  to: EmailAddress;
  subject: string;
  text?: string;
  html?: string;
  /**
   * 用途カテゴリ（例: invite / password_reset / generic など）
   * ログ集計や配信停止制御で利用することを想定。
   */
  category?: string;
}

/**
 * 通知実行時のコンテキスト情報
 * orgId / userId などを持たせることで、監査ログやプロバイダ側のメタデータとして利用できる。
 */
export interface NotificationContext {
  orgId?: string;
  userId?: string;
}

/**
 * 通知の結果
 */
export interface NotificationResult {
  success: boolean;
  error?: string;
  providerMessageId?: string;
}

/**
 * メール送信の抽象インターフェイス
 *
 * 各プロダクトでは、このインターフェイスを実装したクラス/関数を用意し、
 * Resend / SES などお好みのプロバイダに接続してください。
 */
export interface MailSender {
  sendMail(
    message: MailMessage,
    context?: NotificationContext
  ): Promise<NotificationResult>;
}

/**
 * デフォルトの MailSender 実装。
 *
 * 実際のメールは送信せず、サーバーログに内容を出力するだけ。
 * 雛形段階・ローカル開発ではこの実装を使い、本番では各プロダクト側で
 * MailSender を差し替える想定。
 */
export function createConsoleMailSender(): MailSender {
  return {
    async sendMail(message, context) {
      // 実運用では好みのロガーに差し替えてください
      // eslint-disable-next-line no-console
      console.log('[notifications] sendMail (console)', {
        message,
        context,
      });

      return {
        success: true,
      };
    },
  };
}

