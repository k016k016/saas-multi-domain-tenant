/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/config-edge', '@repo/config'],
  experimental: {
    forceSwcTransforms: true,
  },
  // E2Eテスト・認証を正しくテストするため、静的最適化を無効にする
  // production buildでもServer Componentsが毎リクエスト実行されるようにする
  // これにより getCurrentRole() が毎回実行され、権限チェックが正しく動作する
  output: 'standalone',
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
}

export default nextConfig
