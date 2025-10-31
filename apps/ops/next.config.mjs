/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/config-edge', '@repo/config'],
  experimental: { forceSwcTransforms: true },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
}

export default nextConfig
