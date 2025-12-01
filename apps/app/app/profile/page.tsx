/**
 * プロフィール編集ページ
 *
 * 責務:
 * - 現在のユーザー情報を取得
 * - ProfileFormコンポーネントをレンダリング
 */

import { createServerClient } from '@repo/db';
import { getCurrentRole } from '@repo/config';
import { ProfileForm } from './profile-form';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {
  const supabase = await createServerClient();

  // ユーザー情報取得
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    const wwwUrl = process.env.NEXT_PUBLIC_WWW_URL || 'http://www.local.test:3001';
    redirect(`${wwwUrl}/login`);
  }

  // ロール取得
  const roleContext = await getCurrentRole();
  const role = roleContext?.role || 'member';

  // ユーザー情報
  const name = user.user_metadata?.name || '';
  const email = user.email || '';

  return (
    <main
      style={{
        padding: '2rem',
        maxWidth: '600px',
        margin: '0 auto',
      }}
    >
      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: '600',
          marginBottom: '1.5rem',
          color: '#e5e5e5',
        }}
      >
        プロフィール編集
      </h1>

      <ProfileForm initialName={name} email={email} role={role} />

      <p
        style={{
          marginTop: '2rem',
          fontSize: '0.875rem',
          color: '#6b7280',
          textAlign: 'center',
        }}
      >
        <a href="/dashboard" style={{ color: '#60a5fa', textDecoration: 'none' }}>
          ダッシュボードに戻る
        </a>
      </p>
    </main>
  );
}
