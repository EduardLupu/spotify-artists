export interface Top {
    x: string; // City
    c: string; // Country
    l: number; // Listeners
}

export interface Artist {
    i: string; // ID
    n: string; // Name
    p: string; // Image
    l: number | null;  // Monthly Listeners
    f: number | null;  // Followers
    r: number | null;  // Rank
    t: Top[]  | null;  // This allows empty arrays
}

export interface SpotifyArtists {
    t: string;
    a: Artist[];
    x: Artist[];
}