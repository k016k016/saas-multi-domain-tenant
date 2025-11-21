'use client';

/**
 * OPSナビゲーションヘッダー
 *
 * 責務:
 * - ログインページ以外でナビゲーションメニューを表示
 * - usePathnameでパスを判定し、/loginでは非表示
 */

import { usePathname } from 'next/navigation';
import SignOutButton from './signout-button';

export function OpsNav() {
  const pathname = usePathname();

  // ログインページではナビゲーションを表示しない
  if (pathname === '/login') {
    return null;
  }

  return (
    <nav style={{
      padding: '1rem',
      background: '#312e81',
      borderBottom: '2px solid #6366f1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <strong style={{ color: '#a5b4fc' }}>Ops Domain (事業者専用)</strong>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <a href="/" style={{ color: '#c7d2fe', textDecoration: 'none' }}>ダッシュボード</a>
          <a href="/orgs" style={{ color: '#c7d2fe', textDecoration: 'none' }}>組織一覧</a>
          <a href="/orgs/new" style={{ color: '#c7d2fe', textDecoration: 'none' }}>新規組織作成</a>
        </div>
      </div>
      <SignOutButton />
    </nav>
  );
}
