import './globals.css';
import {SpotifyArtistsProvider} from '@/contexts/SpotifyArtistsContext';
import Navigation from "@/components/navigation";
import { montserrat } from "@/lib/fonts";
import React from "react";
import {TooltipProvider} from "@/components/ui/tooltip";
import {baseUrl} from "@/lib/constants";
import { GoogleAnalytics } from "@next/third-parties/google";

export const metadata = {
    title: 'top 500 spotify artists',
    description: `see the world's most accurate top 500 spotify artists list.`,
    metadataBase: new URL(baseUrl),
    openGraph: {
        title: "top 500 spotify artists",
        description:
            "see the world's most accurate top 500 spotify artists list.",
        url: baseUrl,
        siteName: "top 500 spotify artists",
        locale: "en_US",
        type: "website",
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
    icons: {
        icon: [
            {
                rel: "icon",
                url: "/android-icon-36x36.png",
                sizes: "36x36",
                type: "image/png",
            },
            {
                rel: "icon",
                url: "/android-icon-48x48.png",
                sizes: "48x48",
                type: "image/png",
            },
            {
                rel: "icon",
                url: "/android-icon-72x72.png",
                sizes: "72x72",
                type: "image/png",
            },
            {
                rel: "icon",
                url: "/android-icon-96x96.png",
                sizes: "96x96",
                type: "image/png",
            },
            {
                rel: "icon",
                url: "/android-icon-144x144.png",
                sizes: "144x144",
                type: "image/png",
            },
            {
                rel: "icon",
                url: "/android-icon-192x192.png",
                sizes: "192x192",
                type: "image/png",
            },

            // Apple icons
            {
                rel: "apple-touch-icon",
                url: "/apple-icon.png",
                sizes: "unknown",
                type: "image/png",
            },
            {
                rel: "apple-touch-icon",
                url: "/apple-icon-57x57.png",
                sizes: "57x57",
                type: "image/png",
            },
            {
                rel: "apple-touch-icon",
                url: "/apple-icon-60x60.png",
                sizes: "60x60",
                type: "image/png",
            },
            {
                rel: "apple-touch-icon",
                url: "/apple-icon-72x72.png",
                sizes: "72x72",
                type: "image/png",
            },
            {
                rel: "apple-touch-icon",
                url: "/apple-icon-76x76.png",
                sizes: "76x76",
                type: "image/png",
            },
            {
                rel: "apple-touch-icon",
                url: "/apple-icon-114x114.png",
                sizes: "114x114",
                type: "image/png",
            },
            {
                rel: "apple-touch-icon",
                url: "/apple-icon-120x120.png",
                sizes: "120x120",
                type: "image/png",
            },
            {
                rel: "apple-touch-icon",
                url: "/apple-icon-144x144.png",
                sizes: "144x144",
                type: "image/png",
            },
            {
                rel: "apple-touch-icon",
                url: "/apple-icon-152x152.png",
                sizes: "152x152",
                type: "image/png",
            },
            {
                rel: "apple-touch-icon",
                url: "/apple-icon-180x180.png",
                sizes: "180x180",
                type: "image/png",
            },
            {
                rel: "apple-icon-precomposed",
                url: "/apple-icon-precomposed.png",
                sizes: "unknown",
                type: "image/png",
            },

            // Favicons
            {
                rel: "icon",
                url: "/favicon.ico",
                sizes: "unknown",
                type: "image/x-icon",
            },
            {
                rel: "icon",
                url: "/favicon-16x16.png",
                sizes: "16x16",
                type: "image/png",
            },
            {
                rel: "icon",
                url: "/favicon-32x32.png",
                sizes: "32x32",
                type: "image/png",
            },
            {
                rel: "icon",
                url: "/favicon-96x96.png",
                sizes: "96x96",
                type: "image/png",
            },

            // Microsoft icons
            {
                rel: "icon",
                url: "/ms-icon-70x70.png",
                sizes: "70x70",
                type: "image/png",
            },
            {
                rel: "icon",
                url: "/ms-icon-144x144.png",
                sizes: "144x144",
                type: "image/png",
            },
            {
                rel: "icon",
                url: "/ms-icon-150x150.png",
                sizes: "150x150",
                type: "image/png",
            },
            {
                rel: "icon",
                url: "/ms-icon-310x310.png",
                sizes: "310x310",
                type: "image/png",
            },
        ],
        shortcut: { url: "/favicon.ico" },
    },
};

export default function RootLayout({children}: { children: React.ReactNode }) {
    return (
        <html lang="en" className="bg-white text-black">
            <body className={montserrat.className}>
                 <SpotifyArtistsProvider>
                     <TooltipProvider>
                         <Navigation />
                         {children}
                     </TooltipProvider>
                </SpotifyArtistsProvider>
            </body>
            <GoogleAnalytics gaId='G-8G04957GTD' />
        </html>
    );
}
