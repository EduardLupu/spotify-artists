const SPOTIFY_IMG_SIZES = {
    64:  'ab67616d00004851',
    300: 'ab67616d00001e02',
    640: 'ab67616d0000b273',
} as const;

export function spotifyImageAtSize(idOrUrl: string, target: 64 | 300 | 640 = 300) {
    const id = idOrUrl.startsWith('http') ? idOrUrl.split('/').pop()! : idOrUrl;
    const sized = id.replace(/^ab67616d[0-9a-f]{8}/i, SPOTIFY_IMG_SIZES[target]);
    return `https://i.scdn.co/image/${sized}`;
}