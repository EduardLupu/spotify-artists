'use client';
import React, { createContext, useState, useEffect, useContext } from 'react';
import { SpotifyArtists } from "@/types/spotify-artists";
import {Cities} from "@/types/cities"; // Import your TypeScript types

interface SpotifyArtistsContextType {
    spotifyArtists: SpotifyArtists | null;
    cities: Cities | null;
    loading: boolean;
}
const SpotifyArtistsContext = createContext<SpotifyArtistsContextType | undefined>(undefined);

export function SpotifyArtistsProvider({ children }: { children: React.ReactNode }) {
    const [spotifyArtists, setSpotifyArtists] = useState<SpotifyArtists | null>(null);
    const [cities, setCities] = useState<Cities | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {

        const fetchData = async () => {
            const artists = await fetch('https://raw.githubusercontent.com/EduardLupu/spotify-artists/refs/heads/main/public/spotify_artists_data.json');
            const cities = await fetch('https://raw.githubusercontent.com/EduardLupu/spotify-artists/refs/heads/main/public/cities.json');
            const artistsData: SpotifyArtists = await artists.json();
            const citiesData: Cities = await cities.json();
            return {
                artists: artistsData,
                cities: citiesData,
            }
        }

        if (spotifyArtists === null) {
            fetchData().then((data) => {
                setSpotifyArtists(data.artists);
                setCities(data.cities);
                setLoading(false);
            });
        }
    }, []);

    return (
        <SpotifyArtistsContext.Provider value={{ spotifyArtists, cities, loading }}>
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