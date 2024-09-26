'use client';
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Music } from 'lucide-react';
import { useSpotifyArtists } from "@/app/SpotifyArtistsContext";

export default function TopArtistsPage() {
    const { spotifyArtists, loading } = useSpotifyArtists();
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const topArtists = useMemo(() => spotifyArtists?.x || [], [spotifyArtists]);

    if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentArtists = topArtists.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(topArtists.length / itemsPerPage);

    return (
        <div className="flex flex-col justify-between p-6 lg:p-24">
            <Card className="mb-4">
                <CardHeader>
                    <CardTitle>Display Options</CardTitle>
                </CardHeader>
                <CardContent>
                    <label htmlFor="itemsPerPage" className="mr-2">Items per page:</label>
                    <select
                        id="itemsPerPage"
                        value={itemsPerPage}
                        onChange={(e) => {
                            setItemsPerPage(Number(e.target.value));
                            setCurrentPage(1);
                        }}
                        className="border rounded p-1"
                    >
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                    </select>
                </CardContent>
            </Card>
            <Table className="w-full mx-auto border-collapse">
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-gray-800 font-bold">Name</TableHead>
                        <TableHead className="text-center text-gray-800 font-bold">Monthly Listeners</TableHead>
                        <TableHead className="text-center text-gray-800 font-bold">Followers</TableHead>
                        <TableHead className="text-center text-gray-800 font-bold">Rank</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {currentArtists.map((artist) => (
                        <TableRow key={artist.i} className="hover:bg-gray-100">
                            <TableCell className="font-bold">
                                <div className="flex items-center gap-6">
                                    {artist.p ? (
                                        <img
                                            src={`https://i.scdn.co/image/${artist.p}`}
                                            alt={artist.n}
                                            className="w-10 h-10 object-cover rounded-lg"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                                            <Music className="h-6 w-6 text-gray-400" />
                                        </div>
                                    )}
                                    <Link href={`/artist/${artist.i}`} className="text-blue-600 hover:underline">{artist.n}</Link>
                                </div>
                            </TableCell>
                            <TableCell className="text-center">{artist.l ? artist.l.toLocaleString() : '-'}</TableCell>
                            <TableCell className="text-center">{artist.f ? artist.f.toLocaleString() : '-'}</TableCell>
                            <TableCell className="text-center">{artist.r || '-'}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <Pagination className="mt-4">
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                    </PaginationItem>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNumber = currentPage - 2 + i;
                        if (pageNumber > 0 && pageNumber <= totalPages) {
                            return (
                                <PaginationItem key={pageNumber}>
                                    <PaginationLink
                                        onClick={() => setCurrentPage(pageNumber)}
                                        className={currentPage === pageNumber ? 'bg-blue-600 text-white' : 'cursor-pointer'}>
                                        {pageNumber}
                                    </PaginationLink>
                                </PaginationItem>
                            );
                        }
                        return null;
                    })}
                    <PaginationItem>
                        <PaginationNext
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </div>
    );
}
