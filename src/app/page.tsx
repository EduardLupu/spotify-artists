'use client';
import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Star, Users, Disc } from 'lucide-react';

export default function HomePage() {
    return (
        <div className="flex flex-col justify-between p-6 lg:p-24 bg-white">
            <header className="text-center my-10">
                <h1 className="text-4xl font-bold mb-4 text-black">Welcome to Spotify Artists Explorer</h1>
                <p className="text-xl text-black">Discover and explore your favorite artists and their stats</p>
            </header>

            <div className="grid md:grid-cols-2 gap-6 my-10">
                <Link href="/top-artists">
                    <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-white border border-black">
                        <CardHeader>
                            <CardTitle className="flex items-center text-black">
                                <Star className="mr-2 text-black" />
                                <span>Top Artists</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-black">Explore the most popular artists on Spotify</p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/all-artists">
                    <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-white border border-black">
                        <CardHeader>
                            <CardTitle className="flex items-center text-black">
                                <Users className="mr-2 text-black" />
                                <span>All Artists</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-black">Browse our comprehensive list of Spotify artists</p>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            <section className="my-10">
                <h2 className="text-2xl font-bold mb-4 text-black">About Spotify Artists Explorer</h2>
                <p className="text-black">
                    Spotify Artists Explorer is your go-to platform for discovering and exploring artists on Spotify.
                    Whether you're looking for the most popular artists or want to dive deep into our extensive
                    database, we've got you covered. Use our tools to search, sort, and analyze artist data,
                    including monthly listeners, followers, and more.
                </p>
            </section>

            <section className="my-10">
                <h2 className="text-2xl font-bold mb-4 text-black">Features</h2>
                <div className="grid md:grid-cols-3 gap-4">
                    <Card className="bg-white border border-black">
                        <CardHeader>
                            <CardTitle className="flex items-center text-black">
                                <Music className="mr-2 text-black" />
                                <span>Artist Search</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-black">Find artists quickly with our powerful search functionality</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-white border border-black">
                        <CardHeader>
                            <CardTitle className="flex items-center text-black">
                                <Disc className="mr-2 text-black" />
                                <span>Detailed Stats</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-black">View comprehensive statistics for each artist</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-white border border-black">
                        <CardHeader>
                            <CardTitle className="flex items-center text-black">
                                <Users className="mr-2 text-black" />
                                <span>Top Charts</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-black">Explore rankings of the most popular artists</p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            <footer className="text-center my-10">
                <p className="text-black">&copy; 2024 Spotify Artists Explorer. All rights reserved.</p>
            </footer>
        </div>
    );
}
