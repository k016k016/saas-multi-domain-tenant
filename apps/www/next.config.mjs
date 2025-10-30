/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/config-edge'],
  experimental: { forceSwcTransforms: true }
}

export default nextConfig
