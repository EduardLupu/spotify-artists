'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Music } from 'lucide-react';
import { useSpotifyArtists } from "@/app/SpotifyArtistsContext";

export default function AllArtistsPage() {
    const { spotifyArtists, loading } = useSpotifyArtists();
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [sortField, setSortField] = useState<'n' | 'f' | 'l'>('n');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

    const allArtists = useMemo(() => spotifyArtists?.a || [], [spotifyArtists]);

    const filteredArtists = useMemo(() =>
            allArtists.filter(artist =>
                artist.n.toLowerCase().includes(searchTerm.toLowerCase())
            ),
        [allArtists, searchTerm]
    );

    const sortedArtists = useMemo(() =>
            [...filteredArtists].sort((a, b) => {
                if (sortField === 'n') {
                    return sortDirection === 'asc' ? a.n.localeCompare(b.n) : b.n.localeCompare(a.n);
                } else {
                    const aValue = a[sortField] || 0;
                    const bValue = b[sortField] || 0;
                    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
                }
            }),
        [filteredArtists, sortField, sortDirection]
    );

    const letterFilteredArtists = useMemo(() =>
            selectedLetter
                ? sortedArtists.filter(artist => artist.n.toLowerCase().startsWith(selectedLetter.toLowerCase()))
                : sortedArtists,
        [sortedArtists, selectedLetter]
    );

    const totalPages = Math.ceil(letterFilteredArtists.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentArtists = letterFilteredArtists.slice(indexOfFirstItem, indexOfLastItem);

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    const handleSort = (field: 'n' | 'f' | 'l') => {
        if (field === sortField) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    if (loading) return <div className="bg-white text-black flex justify-center items-center h-screen">Loading...</div>;

    return (
        <div className="bg-white flex-col justify-between p-4 px-6 lg:px-24">
            <div className="grid md:grid-cols-2 gap-4 mb-6">
                <Card className="bg-white border border-black">
                    <CardHeader>
                        <CardTitle>Search</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                            <Input
                                type="text"
                                placeholder="Search by artist name"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="pl-8"
                            />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border border-black">
                    <CardHeader>
                        <CardTitle>Dashboard</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={'flex-row justify-between items-end'}>
                            <div className="flex-col justify-between items-center">
                                <p>Total Artists: {spotifyArtists?.a.length}</p>
                                <p>Last
                                    Refreshed: {spotifyArtists?.t ? new Date(spotifyArtists.t).toLocaleString() : "No timestamp available"}</p>
                            </div>
                            <div>
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
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                    <option value="250">250</option>
                                    <option value="500">500</option>
                                </select>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <div className="mb-6 flex justify-center items-center w-full">
                {alphabet.map((letter) => (
                    <button
                        key={letter}
                        onClick={() => {
                            setSelectedLetter(letter);
                            setCurrentPage(1);
                        }}
                        className={`px-2 py-1 m-1 rounded ${selectedLetter === letter ? 'bg-black text-white' : 'bg-gray-200 text-gray-800'}`}
                    >
                        {letter}
                    </button>
                ))}
                <button
                    onClick={() => setSelectedLetter(null)}
                    className={`px-2 py-1 m-1 rounded ${selectedLetter === null ? 'bg-black text-white' : 'bg-gray-200 text-gray-800'}`}
                >
                    All
                </button>
            </div>
            <Table className="text-black w-full mx-auto border-collapse">
                <TableHeader>
                    <TableRow>
                        <TableHead className="font-bold cursor-pointer" onClick={() => handleSort('n')}>
                            Name {sortField === 'n' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </TableHead>
                        <TableHead className="text-center text-gray-800 font-bold cursor-pointer" onClick={() => handleSort('l')}>
                            Monthly Listeners {sortField === 'l' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </TableHead>
                        <TableHead className="text-center text-gray-800 font-bold cursor-pointer" onClick={() => handleSort('f')}>
                            Followers {sortField === 'f' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {currentArtists.map((artist) => (
                        <TableRow key={artist.i} className="hover:bg-gray-100">
                            <TableCell className="font-bold">
                                <div className="flex items-center gap-4">
                                    {artist.p ? (
                                        <img
                                            src={`https://i.scdn.co/image/${artist.p}`}
                                            alt={artist.n}
                                            className="w-12 h-12 rounded-lg object-cover"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg bg-gray-300 flex items-center justify-center">
                                            <Music className="h-6 w-6 text-gray-400" />
                                        </div>
                                    )}
                                    <Link href={`/artist/${artist.i}`} className="hover:underline" title={`Listeners: ${artist.l || 'N/A'}, Followers: ${artist.f || 'N/A'}`}>
                                        {artist.n}
                                    </Link>
                                </div>
                            </TableCell>
                            <TableCell className="text-center">{artist.l ? artist.l.toLocaleString() : '-'}</TableCell>
                            <TableCell className="text-center">{artist.f ? artist.f.toLocaleString() : '-'}</TableCell>
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
                                        className={currentPage === pageNumber ? 'bg-black text-white' : 'cursor-pointer'}>
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