/** @type {import('next').NextConfig} */
const nextConfig = {
    basePath: process.env.NODE_ENV === 'production' ? '/spotify-artists' : '',
    assetPrefix: process.env.NODE_ENV === 'production' ? 'https://eduardlupu.github.io/spotify-artists/' : '',
    images: process.env.NODE_ENV === 'production' ? {
        loader:'akamai',
        path: 'https://eduardlupu.github.io/spotify-artists/'
    } : {},
    output: process.env.NODE_ENV === 'production' ? 'export' : 'standalone'
};

export default nextConfig;