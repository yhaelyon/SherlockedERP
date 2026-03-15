/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@sherlocked/shared'],
  experimental: {
    serverComponentsExternalPackages: [],
  },
}

module.exports = nextConfig
