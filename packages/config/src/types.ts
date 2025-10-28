/**
 * Server Actionの戻り値の標準フォーマット
 *
 * 重要な設計方針:
 * - Server Action内でredirect()は使用しない
 * - 画面遷移はクライアント側でrouter.push(nextUrl)を使って行う
 * - この型から外れる戻り値を発明しない
 */
export type ActionResult<T = void> =
  | {
      success: true;
      data?: T;           // 成功時のデータ（任意）
      nextUrl?: string;   // 遷移先がある場合のみ
    }
  | {
      success: false;
      error: string;      // ユーザー向けエラーメッセージ（日本語）
      nextUrl?: string;   // エラー時の遷移先（任意）
    };
