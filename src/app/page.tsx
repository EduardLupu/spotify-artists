'use client';
import React, { useEffect, useState } from 'react';
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpotifyArtists } from "@/types/spotify-artists";
import { Search, Music } from 'lucide-react';
import Link from "next/link";

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
                setError("Error fetching data");
            } finally {
                setLoading(false);
            }
        };

        fetchArtists();
    }, []);

    if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;
    if (error) return <div className="text-red-500 text-center">{error}</div>;

    const filteredArtists = spotifyArtists?.artists ? spotifyArtists.artists.filter(artist =>
        artist.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        artist.id === searchTerm
    ) : [];

    const totalPages = Math.ceil(filteredArtists.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentArtists = filteredArtists.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6 text-center">Spotify Artists Dashboard</h1>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Search</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search by artist name or ID"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Dashboard Info</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>Total Artists: {spotifyArtists?.artists.length}</p>
                        <p>Last Refreshed: {spotifyArtists?.timestamp ? new Date(spotifyArtists.timestamp).toLocaleString() : "No timestamp available"}</p>
                    </CardContent>
                </Card>
            </div>

            <div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]"></TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>ID</TableHead>
                            <TableHead className="text-right">Listeners</TableHead>
                            <TableHead className="text-right">Followers</TableHead>
                            <TableHead className="text-right">Rank</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentArtists.map((artist) => (
                            <TableRow key={artist.id}>
                                <TableCell>
                                    {artist.img ? (
                                        <img
                                            src={`https://i.scdn.co/image/${artist.img}`}
                                            alt={artist.name}
                                            className="w-10 h-10 object-cover"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                                            <Music className="h-6 w-6 text-gray-400" />
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="font-bold">{artist.name}</TableCell>
                                <Link href={`https://open.spotify.com/artist/${artist.id}`}>
                                    <TableCell className="font-medium">{artist.id}</TableCell>
                                </Link>
                                <TableCell className="text-right">{artist.listeners ? artist.listeners.toLocaleString() : '-'}</TableCell>
                                <TableCell className="text-right">{artist.followers ? artist.followers.toLocaleString() : '-'}</TableCell>
                                <TableCell className="text-right">{artist.rank ? artist.rank : '-'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Pagination className="mt-4">
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                    </PaginationItem>
                    <PaginationItem>
                        <PaginationLink>{currentPage}</PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                        <PaginationNext
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </div>
    );
}