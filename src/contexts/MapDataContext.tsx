'use client';

import React, { createContext, useState, useEffect, useContext } from 'react';

interface ProcessedMapData {
    t: string; // Timestamp
    cityMarkers: Array<{ 
        city: string;
        country: string;
        lat: number;
        lng: number;
        artists: Array<{ 
            artist: string;
            listeners: number;
            image?: string;
        }>;
    }>;
    artistsByCountry: { 
        [key: string]: Array<{ 
            artist: string;
            listeners: number;
            image?: string;
        }>;
    };
}

interface MapDataContextType {
    mapData: ProcessedMapData | null;
    loadingMapData: boolean;
}

const MapDataContext = createContext<MapDataContextType | undefined>(undefined);

export function MapDataProvider({ children }: { children: React.ReactNode }) {
    const [mapData, setMapData] = useState<ProcessedMapData | null>(null);
    const [loadingMapData, setLoadingMapData] = useState(true);

    useEffect(() => {
        const fetchMapData = async () => {
            console.log("Map data fetch started. Loading state:", loadingMapData);
            try {
                const response = await fetch('/processed_map_data.json');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data: ProcessedMapData = await response.json();
                setMapData(data);
            } catch (error) {
                console.error("Failed to fetch map data:", error);
                setMapData(null);
            } finally {
                setLoadingMapData(false);
                console.log("Map data fetch completed. Loading state:", false);
            }
        };

        if (mapData === null) {
            fetchMapData();
        }
    }, [mapData]);

    return (
        <MapDataContext.Provider value={{ mapData, loadingMapData }}>
            {children}
        </MapDataContext.Provider>
    );
}

export function useMapData() {
    const context = useContext(MapDataContext);
    if (context === undefined) {
        throw new Error('useMapData must be used within a MapDataProvider');
    }
    return context;
} 