/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@repo/config', '@repo/db'],
};

module.exports = nextConfig;
