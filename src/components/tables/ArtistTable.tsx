import React, { Fragment } from 'react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Music } from 'lucide-react';
import { abbreviateNumber } from "@/utils/helpers";
import {getCountryByAlpha2} from "country-locale-map";

interface ArtistTableProps {
    artists: any[];
    onSort: (field: 'n' | 'f' | 'l' | 'r' | null) => void;
    sortField: 'n' | 'f' | 'l' | 'r' | null;
    sortDirection: 'asc' | 'desc';
    currentPage: number;
    itemsPerPage: number;
    expandedArtist: string | null;
    toggleArtistExpansion: (artistId: string) => void;
    showRank?: boolean;
    showDetailedNumbers: boolean
}

export const ArtistTable: React.FC<ArtistTableProps> = ({
                                                            artists,
                                                            onSort,
                                                            sortField,
                                                            sortDirection,
                                                            expandedArtist,
                                                            toggleArtistExpansion,
                                                            showRank = false,
                                                            showDetailedNumbers = false,
                                                        }) => {
    return (
        <Table className="text-black mx-auto w-5/6 border-collapse border-gray-700 text-xs">
            <TableHeader>
                <TableRow>
                    {showRank && (
                        <TableHead className="text-black font-bold border-b border-black text-center">
                            Rank
                        </TableHead>
                    )}
                    <TableHead
                        className="text-black font-bold cursor-pointer border-b border-black"
                        onClick={() => onSort('n')}
                    >
                        Name {sortField === 'n' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </TableHead>
                    <TableHead
                        className="text-center text-black font-bold cursor-pointer border-b border-black"
                        onClick={() => onSort('l')}
                    >
                        Monthly Listeners {sortField === 'l' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </TableHead>
                    <TableHead
                        className="text-center text-black font-bold cursor-pointer border-b border-black"
                        onClick={() => onSort('f')}
                    >
                        Followers {sortField === 'f' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {artists.map((artist) => (
                    <Fragment key={artist.i}>
                        <TableRow
                            className="hover:bg-gray-200 cursor-pointer"
                            onClick={() => toggleArtistExpansion(artist.i)}
                        >
                            {showRank && (
                                <TableCell className="text-center border-b border-black">
                                    {artist?.r}
                                </TableCell>
                            )}
                            <TableCell className="font-bold border-b border-black">
                                <div className="flex items-center gap-4">
                                    {artist.p ? (
                                        <img
                                            src={`https://i.scdn.co/image/${artist.p}`}
                                            alt={artist.n}
                                            className="w-12 h-12 rounded-lg object-cover"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg bg-gray-300 flex items-center justify-center">
                                            <Music className="h-6 w-6 text-black" />
                                        </div>
                                    )}
                                    <Link
                                        href={`https://open.spotify.com/artist/${artist.i}`}
                                        title={'View Artist on Spotify'}
                                        target={'_blank'}
                                        rel={'noopener noreferrer nofollow'}
                                        className="text-black hover:underline hover:underline-offset-4"
                                    >
                                        {artist.n}
                                    </Link>
                                </div>
                            </TableCell>
                            <TableCell className="text-center border-b border-black">
                                {artist.l ? showDetailedNumbers ? artist.l.toLocaleString() : abbreviateNumber(artist.l) : '-'}
                            </TableCell>
                            <TableCell className="text-center border-b border-black">
                                {artist.f ? showDetailedNumbers ? artist.f.toLocaleString() : abbreviateNumber(artist.f) : '-'}
                            </TableCell>
                        </TableRow>
                        {expandedArtist === artist.i && artist.t && artist.t.length > 0 && (
                            <TableRow className="bg-gray-100">
                                <TableCell colSpan={showRank ? 4 : 3} className="text-black p-4">
                                    <div className="font-bold mb-2 text-center">top locations:</div>
                                    <ul>
                                        {artist.t.map((topCity: any, index: number) => (
                                            <li key={topCity.x} className="mb-2 text-center font-bold">
                                                {index+1}. {topCity.x}, {getCountryByAlpha2(topCity.c)?.name} {getCountryByAlpha2(topCity.c)?.emoji}  | {" "}
                                                {showDetailedNumbers ? topCity.l.toLocaleString() : abbreviateNumber(topCity.l)} {" "} listeners
                                                {" "} listeners
                                            </li>
                                        ))}
                                    </ul>
                                </TableCell>
                            </TableRow>
                        )}
                    </Fragment>
                ))}
            </TableBody>
        </Table>
    );
};
