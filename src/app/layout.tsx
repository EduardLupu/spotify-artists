// app/layout.tsx (or .js)
import './globals.css';
import {SpotifyArtistsProvider} from '@/app/SpotifyArtistsContext';
import Navigation from "@/components/navigation";
import React from "react";

export const metadata = {
    title: 'Spotify Artists',
    description: 'Browse Spotify Artists',
};

export default function RootLayout({children}: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                 <SpotifyArtistsProvider>
                     <Navigation />
                    {children}
                </SpotifyArtistsProvider>
            </body>
        </html>
    );
}
