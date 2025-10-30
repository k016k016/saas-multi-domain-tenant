/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/config-edge', '@repo/config'],
  experimental: { forceSwcTransforms: true }
}

export default nextConfig
