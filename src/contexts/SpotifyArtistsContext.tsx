'use client';
import React, { createContext, useState, useEffect, useContext } from 'react';
import { SpotifyArtists } from "@/types/spotify-artists"; // Import your TypeScript types

interface SpotifyArtistsContextType {
    spotifyArtists: SpotifyArtists | null;
    loading: boolean;
}
const SpotifyArtistsContext = createContext<SpotifyArtistsContextType | undefined>(undefined);

export function SpotifyArtistsProvider({ children }: { children: React.ReactNode }) {
    const [spotifyArtists, setSpotifyArtists] = useState<SpotifyArtists | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {

        const fetchData = async () => {
            const response = await fetch('https://raw.githubusercontent.com/EduardLupu/spotify-artists/refs/heads/main/public/spotify_artists_data.json');
            return await response.json();
        }

        if (spotifyArtists === null) {
            fetchData().then((data) => {
                setSpotifyArtists(data);
                setLoading(false);
            });
        }
    }, []);

    return (
        <SpotifyArtistsContext.Provider value={{ spotifyArtists, loading }}>
            {children}
        </SpotifyArtistsContext.Provider>
    );
}

// Custom hook to use the SpotifyArtistsContext
export function useSpotifyArtists() {
    const context = useContext(SpotifyArtistsContext);
    if (context === undefined) {
        throw new Error('useSpotifyArtists must be used within a SpotifyArtistsProvider');
    }
    return context;
}