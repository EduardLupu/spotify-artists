'use client';
import React from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';

const Navigation = () => {
    const pathname = usePathname();

    return (
        <nav className="p-4 px-6 lg:px-24 bg-white">
            <ul className="flex space-x-4 gap-12 text-black" >
                <li>
                    <Link href="/">
                        home
                    </Link>
                </li>
                <li>
                    <Link href="/top-artists">
                        top 500 spotify artists
                    </Link>
                </li>
                <li>
                    <Link href="/all-artists">
                         spotify artists
                    </Link>
                </li>
            </ul>
        </nav>
    );
};

export default Navigation;