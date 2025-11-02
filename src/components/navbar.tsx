"use client"

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
    ArchiveRestore,
    ArrowUpRight,
    Globe2,
    Menu, MicVocal,
    Orbit,
    X
} from 'lucide-react'

export default function Navbar() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const toggleRef = useRef<HTMLButtonElement | null>(null)
    const [portalTogglePos, setPortalTogglePos] = useState<{top: number; left: number; width: number; height: number} | null>(null)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        const media = window.matchMedia('(min-width: 768px)')
        const onChange = (event: MediaQueryListEvent) => {
            if (event.matches) setMobileMenuOpen(false)
        }
        media.addEventListener('change', onChange)
        return () => media.removeEventListener('change', onChange)
    }, [])

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMobileMenuOpen(false)
        }
        if (mobileMenuOpen) document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [mobileMenuOpen])

    // When opening the mobile menu, capture the toggle button's screen position
    useEffect(() => {
        if (!mobileMenuOpen) {
            setPortalTogglePos(null)
            return
        }
        let raf = 0
        const el = toggleRef.current
        if (!el || !mounted) return

        const update = () => {
            const rect = el.getBoundingClientRect()
            setPortalTogglePos({top: rect.top + window.scrollY, left: rect.left + window.scrollX, width: rect.width, height: rect.height})
            raf = requestAnimationFrame(update)
        }

        // initial set
        update()

        const onWinChange = () => {
            // do nothing here; RAF loop will pick up new rect on next frame
        }

        window.addEventListener('scroll', onWinChange, {passive: true})
        window.addEventListener('resize', onWinChange)
        window.addEventListener('orientationchange', onWinChange)

        return () => {
            cancelAnimationFrame(raf)
            window.removeEventListener('scroll', onWinChange)
            window.removeEventListener('resize', onWinChange)
            window.removeEventListener('orientationchange', onWinChange)
            setPortalTogglePos(null)
        }
    }, [mobileMenuOpen, mounted])

    const getIconLabel = (label: string) => {
        switch (label) {
            case 'Top 500 Artists':
                return <MicVocal className="h-3.5 w-3.5 mr-2" />;
            case 'Former 500 Artists':
                return <ArchiveRestore className="h-3.5 w-3.5 mr-2" />;
            case 'World Atlas':
                return <Globe2 className="h-3.5 w-3.5 mr-2" />;
            case 'Artist Constellation':
                return <Orbit className="h-3.5 w-3.5 mr-2" />;
            default:
                return null;
        }
    };

    const mobileMenu = (
        <>
            <div
                className="fixed inset-0 z-[9998] bg-black/60 md:hidden"
                onClick={() => setMobileMenuOpen(false)}
                aria-hidden
            />

            <nav
                role="dialog"
                aria-label="Mobile navigation"
                className="fixed left-4 right-4 top-20 z-[9999] mx-auto w-auto max-w-sm rounded-3xl border border-white/10 bg-black/85 p-4 text-sm text-white/75 shadow-2xl md:hidden transition-transform duration-200 mt-3"
            >
                {[
                    ['/', 'Top 500 Artists'],
                    ['/former', 'Former 500 Artists'],
                    ['/world-map', 'World Atlas'],
                    ['/graph', 'Artist Constellation'],
                ].map(([href, label]) => (
                    <Link
                        key={href}
                        href={href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-3 py-2 mb-2 transition hover:border-emerald-300/40 hover:bg-emerald-400/10 hover:text-white"
                    >
                        {getIconLabel(label)}
                        <span>{label}</span>
                        <ArrowUpRight className="h-4 w-4" />
                    </Link>
                ))}
            </nav>

            {/* Render a duplicate toggle (X) positioned exactly over the original, but inside the portal so it isn't affected by backdrop blur */}
            {portalTogglePos && (
                <button
                    type="button"
                    aria-label="Close navigation"
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                        position: 'fixed',
                        top: portalTogglePos.top,
                        left: portalTogglePos.left,
                        width: portalTogglePos.width,
                        height: portalTogglePos.height,
                        transform: 'translateZ(0)',
                        WebkitBackfaceVisibility: 'hidden',
                        backfaceVisibility: 'hidden',
                        WebkitTapHighlightColor: 'transparent',
                        // ensure no backdrop filters affect this element
                        backdropFilter: 'none',
                    }}
                    className="z-[10002] isolate inline-flex items-center justify-center rounded-full border border-white/10 bg-black/90 text-white/90 md:hidden shadow-lg"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            )}
        </>
    )

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
                    ref={toggleRef}
                    type="button"
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:bg-white/15 md:hidden ${mobileMenuOpen ? 'opacity-0 pointer-events-none' : 'bg-white/5'}`}
                    onClick={() => setMobileMenuOpen((p) => !p)}
                    aria-label="Toggle navigation"
                    aria-expanded={mobileMenuOpen}
                >
                    <Menu className="h-3.5 w-3.5" />
                </button>
            </div>

            {mounted && mobileMenuOpen && createPortal(mobileMenu, document.body)}
        </div>
    )
}
