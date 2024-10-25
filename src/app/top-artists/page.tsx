'use client';
import React, {useMemo, useState} from 'react';
import {Input} from "@/components/ui/input";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Search} from 'lucide-react';
import {Switch} from "@/components/ui/switch";
import {useSpotifyArtists} from "@/contexts/SpotifyArtistsContext";
import {ArtistTable} from "@/components/tables/ArtistTable";
import {
    Pagination,
    PaginationContent,
    PaginationItem, PaginationLink,
    PaginationNext,
    PaginationPrevious
} from "@/components/ui/pagination";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";

export default function AllArtistsPage() {
    const {spotifyArtists, loading} = useSpotifyArtists();
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [sortField, setSortField] = useState<'n' | 'f' | 'l' | 'r' | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [expandedArtist, setExpandedArtist] = useState<string | null>(null);
    const [showDetailedNumbers, setShowDetailedNumbers] = useState(false);

    const topArtists = useMemo(() => spotifyArtists?.x || [], [spotifyArtists]);

    const filteredArtists = useMemo(() =>
            topArtists.filter(artist =>
                artist.n.toLowerCase().includes(searchTerm.toLowerCase())
            ),
        [topArtists, searchTerm]
    );

    const sortedArtists = useMemo(() =>
            [...filteredArtists].sort((a, b) => {
                if (sortField === 'n') {
                    return sortDirection === 'asc' ? a.n.localeCompare(b.n) : b.n.localeCompare(a.n);
                } else {

                    if (!sortField) return 0;
                    const aValue = a[sortField] || 0;
                    const bValue = b[sortField] || 0;
                    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
                }
            }),
        [filteredArtists, sortField, sortDirection]
    );


    const totalPages = Math.ceil(sortedArtists.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentArtists = sortedArtists.slice(indexOfFirstItem, indexOfLastItem);

    const handleSort = (field: 'n' | 'f' | 'l' | 'r' | null) => {
        if (!field) return;
        if (field === sortField) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const toggleArtistExpansion = (artistId: string) => {
        setExpandedArtist(expandedArtist === artistId ? null : artistId);
    };

    if (loading) return <div className="bg-white text-black flex justify-center items-center h-screen text-xs font-bold">loading a lot of data... please wait!</div>;

    return (
        <div className="bg-white flex-col justify-between p-4 px-6 lg:px-24">
            <div className="grid md:grid-cols-2 gap-4 mb-6">
                <Card className="bg-white border border-black">
                    <CardHeader>
                        <CardTitle>Search</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-black"/>
                            <Input
                                type="text"
                                placeholder="Search by artist name"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="pl-8 border border-black"
                            />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border border-black shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex justify-between">Dashboard
                            <Tooltip>
                                <TooltipTrigger>
                                    <Switch id="dashboard-toggle" checked={showDetailedNumbers} onCheckedChange={setShowDetailedNumbers}/>
                                </TooltipTrigger>
                                <TooltipContent>
                                    toggle the switch to see the exact numbers
                                </TooltipContent>
                            </Tooltip>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-row justify-between items-end">
                            <div className="flex flex-col justify-between items-start">
                                <p>Total Top 500 Artists: {spotifyArtists?.x.length}</p>
                                <p>Last
                                    Refreshed: {spotifyArtists?.t ? new Date(spotifyArtists.t).toLocaleString() : "No timestamp available"}</p>
                            </div>
                            <div className="ml-auto">
                                <label htmlFor="itemsPerPage" className="mr-2">Artists per page:</label>
                                <select
                                    id="itemsPerPage"
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="border border-black p-1"
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
            <ArtistTable
                artists={currentArtists}
                onSort={handleSort}
                sortField={sortField}
                sortDirection={sortDirection}
                expandedArtist={expandedArtist}
                toggleArtistExpansion={toggleArtistExpansion}
                showRank={true}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                showDetailedNumbers={showDetailedNumbers}
            />
            <Pagination className="mt-4">
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            className={currentPage === 1 ? 'bg-gray-200 text-black pointer-events-none opacity-50' : 'cursor-pointer bg-gray-200 text-black'}
                        />
                    </PaginationItem>
                    {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                        const pageNumber = currentPage - 2 + i;
                        if (pageNumber > 0 && pageNumber <= totalPages) {
                            return (
                                <PaginationItem key={pageNumber} className="bg-gray-200 text-black">
                                    <PaginationLink
                                        onClick={() => setCurrentPage(pageNumber)}
                                        className={currentPage === pageNumber ? 'bg-black text-white cursor-pointer' : 'cursor-pointer bg-gray-200 text-black'}>
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
                            className={currentPage === totalPages ? 'bg-gray-200 text-black pointer-events-none opacity-50' : 'cursor-pointer bg-gray-200 text-black'}
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </div>
    );
}
