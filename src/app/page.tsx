'use client';
import React, { useEffect, useState } from 'react';
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpotifyArtists } from "@/types/spotify-artists";
import { Search, Music } from 'lucide-react';
import Link from "next/link";

import jsonData from "../../public/spotify_artists_data.json";

export default function SpotifyArtistsDashboard() {
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [spotifyArtists, setSpotifyArtists] = useState<SpotifyArtists | null>(null);
    const [loading, setLoading] = useState(true);
    const itemsPerPage = 10;

    useEffect(() => {
        setSpotifyArtists(jsonData);
        setLoading(false);
    }, []);

    if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

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
                                onChange={(e) => {
                                    setSearchTerm(e.target.value)
                                    setCurrentPage(1)
                                }}
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
                        <p>Last Refreshed: {spotifyArtists?.timestamp ? new Date(spotifyArtists.timestamp).toLocaleString() + " UTC" : "No timestamp available"}</p>
                    </CardContent>
                </Card>
            </div>

            <div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-white font-bold">Name</TableHead>
                            <TableHead className="text-center text-white font-bold">ID</TableHead>
                            <TableHead className="text-center text-white font-bold">Monthly Listeners</TableHead>
                            <TableHead className="text-center text-white font-bold">Followers</TableHead>
                            <TableHead className="text-center text-white font-bold">Rank</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentArtists.map((artist) => (
                            <React.Fragment key={artist.id}>
                                <TableRow>
                                    <TableCell className="font-bold text-center">
                                        <div className="flex items-center gap-6">
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
                                        {artist.name}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-bold opacity-80 text-center"><Link href={`https://open.spotify.com/artist/${artist.id}`}>{artist.id}</Link></TableCell>
                                    <TableCell className="font-bold text-center">{artist.listeners ? artist.listeners.toLocaleString() : '-'}</TableCell>
                                    <TableCell className="font-bold text-center">{artist.followers ? artist.followers.toLocaleString() : '-'}</TableCell>
                                    <TableCell className="font-bold text-center">{artist.rank ? artist.rank : '-'}</TableCell>
                                </TableRow>
                                {artist.top && artist.top.length > 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="bg-gray-700 p-2">
                                            <div className="font-semibold">Top Cities:</div>
                                            <ul className="list-disc pl-6">
                                                {artist.top.map((city, index) => (
                                                    <li key={index}>
                                                        {city.city}, {city.country} ({city.numberOfListeners.toLocaleString()} listeners)
                                                    </li>
                                                ))}
                                            </ul>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
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