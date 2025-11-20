'use client';

/**
 * サインアウトボタン（Client Component）
 *
 * 重要な設計方針:
 * - Server Actionを呼び出す
 * - Server ActionはnextUrlを返す（redirect()しない）
 * - このComponentが window.location.assign(nextUrl) で遷移する
 */

import { useState } from 'react';
import { logoutAction } from './logout/actions';

export default function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);

    try {
      const result = await logoutAction();

      if (result.success && result.nextUrl) {
        // サインアウト成功: WWWドメインのサインインページへ遷移
        window.location.assign(result.nextUrl);
      } else {
        // エラーメッセージを表示（オプション）
        const errorMessage = !result.success ? result.error : 'サインアウトに失敗しました';
        alert(errorMessage);
        setIsLoading(false);
      }
    } catch (err) {
      alert('サインアウトに失敗しました');
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      style={{
        padding: '0.5rem 1rem',
        background: '#dc2626',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: isLoading ? 'not-allowed' : 'pointer',
        opacity: isLoading ? 0.6 : 1,
      }}
    >
      {isLoading ? 'サインアウト中...' : 'サインアウト'}
    </button>
  );
}
