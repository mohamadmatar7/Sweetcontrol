/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    trustProxy: true,
  },
  async redirects() {
    return [];
  },
};

module.exports = nextConfig;
