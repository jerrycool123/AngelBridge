import path from 'path';
import { fileURLToPath } from 'url';

// ? Note: ES6 modules don't have __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@angel-bridge/common'],
  reactStrictMode: true,
  images: {
    domains: ['cdn.discordapp.com', 'yt3.ggpht.com'],
  },
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
};

export default nextConfig;
