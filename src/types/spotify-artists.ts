export interface Top {
    city: string;
    country: string;
    numberOfListeners: number;
    region: string;
}

export interface Artist {
    id: string;
    name: string;
    img: string;
    listeners: number | null;  // Allow null
    followers: number;
    rank: number | null;  // Allow null
    top: Top[];  // This allows empty arrays
}

export interface SpotifyArtists {
    timestamp: string;
    artists: Artist[];
}