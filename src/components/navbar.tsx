"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Menu, X } from 'lucide-react'

export default function Navbar() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    useEffect(() => {
        const media = window.matchMedia('(min-width: 768px)')
        const onChange = (event: MediaQueryListEvent) => {
            if (event.matches) setMobileMenuOpen(false)
        }
        media.addEventListener('change', onChange)
        return () => media.removeEventListener('change', onChange)
    }, [])

    return (
        <div className="relative">
            <div className="flex items-center gap-3">
                <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/70 md:flex">
                    <Link href="/" className="rounded-full px-3 py-1 hover:bg-white/15 hover:text-white transition">
                        Top 500
                    </Link>
                    <Link href="/former" className="rounded-full px-3 py-1 hover:bg-white/15 hover:text-white transition">
                        Former 500
                    </Link>
                    <Link href="/world-map" className="rounded-full px-3 py-1 hover:bg-white/15 hover:text-white transition">
                        World Atlas
                    </Link>
                    <Link href="/graph" className="rounded-full px-3 py-1 hover:bg-white/15 hover:text-white transition">
                        Artist Graph
                    </Link>
                </nav>

                <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/15 md:hidden"
                    onClick={() => setMobileMenuOpen((p) => !p)}
                    aria-label="Toggle navigation"
                >
                    {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
            </div>

            {mobileMenuOpen && (
                <nav className="absolute right-0 mt-3 flex w-56 flex-col gap-2 rounded-3xl border border-white/10 bg-black/80 p-4 text-sm text-white/75 shadow-lg backdrop-blur-md md:hidden">
                    {[
                        ['/', 'Top 500'],
                        ['/former', 'Former 500'],
                        ['/world-map', 'World Atlas'],
                        ['/graph', 'Artist Graph'],
                    ].map(([href, label]) => (
                        <Link
                            key={href}
                            href={href}
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-3 py-2 transition hover:border-emerald-300/40 hover:bg-emerald-400/10 hover:text-white"
                        >
                            <span>{label}</span>
                            <ArrowUpRight className="h-4 w-4" />
                        </Link>
                    ))}
                </nav>
            )}
        </div>
    )
}

