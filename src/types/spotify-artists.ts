export interface SpotifyArtists {
    timestamp: string
    artists: Artist[]
}

export interface Artist {
    id: string
    name: string
    img: string
    listeners: number
    followers: number
    rank: number
    top: TopCity[]
}

export interface TopCity {
    city: string
    country: string
    numberOfListeners: number
    region: string
}
