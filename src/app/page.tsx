'use client';
import React, {useEffect, useState } from 'react';
import { Input } from "@/components/ui/input";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import {SpotifyArtists} from "@/types/spotify-artists";

export default function SpotifyArtistsDashboard() {
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [spotifyArtists, setSpotifyArtists] = useState<SpotifyArtists | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const itemsPerPage = 10;

    useEffect(() => {
        const fetchArtists = async () => {
            try {
                const response = await fetch('/spotify_artists_data.json');
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const data = await response.json();
                setSpotifyArtists(data);
            } catch (error) {
                setError("Error");
            } finally {
                setLoading(false);
            }
        };

        fetchArtists();
    }, []);

    if (loading) return <div className="text-center">Loading...</div>;
    if (error) return <div className="text-red-500">Failed to load: {error}</div>;

    const filteredArtists = spotifyArtists?.artists ? spotifyArtists.artists.filter(artist =>
        artist.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        artist.id.includes(searchTerm)
    ) : [];

    const totalPages = Math.ceil(filteredArtists.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentArtists = filteredArtists.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Spotify Artists Dashboard</h1>

            <div className="mb-4">
                <Input
                    type="text"
                    placeholder="Search by artist name or ID"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                />
            </div>

            <div className="mb-4">
                <p>Total Artists: {spotifyArtists.artists.length}</p>
                <p>Last Refreshed: {new Date(spotifyArtists.timestamp).toLocaleString()}</p>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Image</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Listeners</TableHead>
                        <TableHead>Followers</TableHead>
                        <TableHead>Rank</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {currentArtists.map((artist) => (
                        <TableRow key={artist.id}>
                            <TableCell>
                                <img
                                    src={`https://i.scdn.co/image/${artist.img}`}
                                    alt={artist.name}
                                    className="w-10 h-10 rounded-full"
                                />
                            </TableCell>
                            <TableCell>{artist.name}</TableCell>
                            <TableCell>{artist.id}</TableCell>
                            <TableCell>{artist.listeners}</TableCell>
                            <TableCell>{artist.followers}</TableCell>
                            <TableCell>{artist.rank}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <Pagination className="mt-4">
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                        />
                    </PaginationItem>
                    {[...Array(totalPages)].map((_, index) => (
                        <PaginationItem key={index}>
                            <PaginationLink
                                onClick={() => setCurrentPage(index + 1)}
                                isActive={currentPage === index + 1}
                            >
                                {index + 1}
                            </PaginationLink>
                        </PaginationItem>
                    ))}
                    <PaginationItem>
                        <PaginationNext
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </div>
    );
}