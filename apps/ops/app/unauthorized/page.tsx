/**
 * ops ドメイン: /unauthorized
 *
 * 権限不足エラーページ
 */

import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">403</h1>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">アクセス権限がありません</h2>
          <p className="text-gray-600 mb-8">
            このページにアクセスする権限がありません。
            <br />
            運用管理者権限が必要です。
          </p>
          <div className="space-y-4">
            <Link
              href="/"
              className="inline-block w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              ホームに戻る
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
