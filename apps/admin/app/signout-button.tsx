'use client';

/**
 * サインアウトボタン（Client Component）
 *
 * Supabase Authを使用してサインアウトし、ログインページへリダイレクト
 */

import { createBrowserClient } from '@supabase/ssr';

export default function SignOutButton() {
  const handleSignOut = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    // wwwドメインのログインページへリダイレクト
    window.location.href = 'http://www.local.test:3001/login';
  };

  return (
    <button
      onClick={handleSignOut}
      style={{
        padding: '0.5rem 1rem',
        background: '#dc2626',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.875rem',
      }}
    >
      サインアウト
    </button>
  );
}
