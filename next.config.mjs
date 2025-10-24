/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: process.env.NODE_ENV === 'production' ? '/music.eduardlupu.com' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? 'https://music.eduardlupu.com/' : '',
  images: process.env.NODE_ENV === 'production' ? {
    loader:'akamai',
    path: 'https://music.eduardlupu.com/',
    unoptimized: true
  } : {},
  output: process.env.NODE_ENV === 'production' ? 'export' : 'standalone'
};

export default nextConfig;