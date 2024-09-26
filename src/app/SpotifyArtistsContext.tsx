// app/SpotifyArtistsContext.tsx
'use client';
import React, { createContext, useState, useEffect, useContext } from 'react';
import { SpotifyArtists } from "@/types/spotify-artists"; // Import your TypeScript types
import jsonData from '../../public/spotify_artists_data.json'; // Path to your JSON file

// Define the context type
interface SpotifyArtistsContextType {
    spotifyArtists: SpotifyArtists | null;
    loading: boolean;
}

// Create the context
const SpotifyArtistsContext = createContext<SpotifyArtistsContextType | undefined>(undefined);

// Create the Provider component
export function SpotifyArtistsProvider({ children }: { children: React.ReactNode }) {
    const [spotifyArtists, setSpotifyArtists] = useState<SpotifyArtists | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load data only once
        setSpotifyArtists(jsonData as SpotifyArtists);
        setLoading(false);
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