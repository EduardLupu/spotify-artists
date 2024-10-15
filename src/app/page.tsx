'use client';
import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Users, Disc } from 'lucide-react';

export default function HomePage() {
    return (
        <div className="flex flex-col justify-between px-6 lg:px-24 bg-white">
            <div className="grid md:grid-cols-3 gap-6 my-10">
                <Link href="/top-artists">
                    <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-white border border-black">
                        <CardHeader>
                            <CardTitle className="flex items-center text-black">
                                <Star className="mr-2 text-black" />
                                <span>top artists</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-black">see the most accurate top 500 spotify artists.</p>
                        </CardContent>
                    </Card>
                </Link>


                <Link href={'https://github.com/EduardLupu/spotify-artists/pulls'} title={'Go to Pull Requests'} target={'_blank'}>
                <Card className="bg-white border border-black">
                    <CardHeader>
                        <CardTitle className="flex items-center text-black">
                            <Disc className="mr-2 text-black" />
                            <span>add an artist</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-black">if you want to add an artist to monitor, open a pull request.</p>
                    </CardContent>
                </Card>
                </Link>

                <Link href="/all-artists">
                    <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-white border border-black">
                        <CardHeader>
                            <CardTitle className="flex items-center text-black">
                                <Users className="mr-2 text-black" />
                                <span>all artists</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-black">check out 158k artists we monitor daily.</p>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            <section className="my-6">
                <p className="text-black text-center text-xs font-bold">this project is open-source. any help is appreciated. feel free to contribute on <Link href={'https://github.com/EduardLupu/spotify-artists'} title={'View on GitHub'} className="underline underline-offset-4" target={'_blank'}>github</Link>.
                    support me on <Link href={'https://buymeacoffee.com/eduardlupu'} title={'Buy me a coffee'} className="underline underline-offset-4" target={'_blank'}>buymeacoffee</Link> or <Link href={'https://github.com/sponsors/EduardLupu'} target={'_blank'} title={'GitHub Sponsors'} className="underline underline-offset-4">github sponsors</Link>.
                </p>
                <p className={'text-black text-center text-xs font-bold my-6'}>&copy; {new Date().getFullYear()} created by <Link href={'https://eduardlupu.com/'} title={'check out my personal site'} className="underline underline-offset-4" target={'_blank'}>eduard lupu</Link></p>
            </section>
        </div>
    );
}
