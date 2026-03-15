/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@sherlocked/shared'],
  experimental: {
    serverComponentsExternalPackages: [],
  },
}

module.exports = nextConfig
