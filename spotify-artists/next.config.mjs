/** @type {import('next').NextConfig} */
const nextConfig = {
    basePath: process.env.NODE_ENV === 'production' ? '/spotify-artists/spotify-artists' : '',
    assetPrefix: process.env.NODE_ENV === 'production' ? 'https://spotify-artists.eduardlupu.io/' : '',
    images: process.env.NODE_ENV === 'production' ? {
        loader:'akamai',
        path: 'https://spotify-artists.eduardlupu.io/'
    } : {},
    output: process.env.NODE_ENV === 'production' ? 'export' : 'standalone'
};

export default nextConfig;