'use client';

/**
 * app ドメイン: error.tsx
 *
 * エラーバウンダリ
 */

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">エラー</h1>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">問題が発生しました</h2>
          <p className="text-gray-600 mb-8">
            申し訳ございません。予期しないエラーが発生しました。
            {error.digest && (
              <>
                <br />
                <span className="text-sm text-gray-500">エラーID: {error.digest}</span>
              </>
            )}
          </p>
          <div className="space-y-4">
            <button
              onClick={reset}
              className="inline-block w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              再試行
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
