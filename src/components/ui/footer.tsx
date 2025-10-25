"use client"

import * as React from "react"
import Link from "next/link"

/**
 * AppFooter – minimal, modern, Spotify-themed footer
 * - Subtle top border, translucent surface, small type
 * - Theme tokens match the chart cards (see CSS variables below)
 * - Includes: start date note, legal disclaimer, and external links
 * - Drop-in component: <AppFooter />
 */

export type AppFooterProps = {
  appName?: string
  since?: string // ISO date; default "2025-10-24"
  siteUrl?: string // default "https://eduardlupu.com"
  version?: string
  githubUrl?: string
  contactEmail?: string
}

export default function Footer({
                                    appName = "Artist Metrics",
                                    since = "2025-10-24",
                                    siteUrl = "https://eduardlupu.com",
                                    version,
                                    githubUrl,
                                    contactEmail,
                                  }: AppFooterProps) {
  const themeVars: React.CSSProperties = {
    ["--spotify-accent" as any]: "#1DB954",
    ["--surface-border" as any]: "rgba(255,255,255,0.08)",
    ["--muted" as any]: "rgba(226,232,240,0.7)",
  }

  const sinceDate = React.useMemo(() => {
    try {
      const d = new Date(since)
      if (Number.isNaN(d.getTime())) return since
      return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })
    } catch {
      return since
    }
  }, [since])

  return (
      <footer
          style={themeVars}
          className="border-t border-[var(--surface-border)] bg-black/40 backdrop-blur-sm"
          role="contentinfo"
      >
        <div className="mx-auto w-full max-w-6xl py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Left: brand + since */}
            <div className="flex items-center gap-3 text-sm text-zinc-200">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-white/5 px-3 py-1 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--spotify-accent)]" />
              {appName}
              {version ? <span className="text-zinc-400">· v{version}</span> : null}
            </span>
              <span className="text-xs text-[var(--muted)]">Collecting data since {sinceDate}</span>
            </div>

            {/* Right: links */}
            <nav aria-label="Footer links" className="flex items-center gap-4 text-sm">
              <External href={siteUrl} label="eduardlupu.com" />
              {githubUrl ? <External href={githubUrl} label="GitHub" /> : null}
              {contactEmail ? <External href={`mailto:${contactEmail}`} label="Contact" /> : null}
            </nav>
          </div>

          {/* Legal + disclosure */}
          <p className="mt-4 max-w-4xl text-pretty text-xs leading-relaxed text-[var(--muted)]">
            This project is independent and for educational and research purposes only. It is not affiliated with, endorsed, or sponsored by Spotify, Apple Music, or any other brand. Names, logos, and assets are the property of their respective owners. Metrics shown are based on publicly available or user-provided data and may include estimates; no warranty is expressed or implied. If you are a rights holder and have concerns, please reach out{contactEmail ? ` at ${contactEmail}` : " via the contact link"}.
          </p>
        </div>
      </footer>
  )
}

function External({ href, label }: { href: string; label: string }) {
  return (
      <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-transparent px-2 py-1 text-zinc-300 underline-offset-4 transition hover:text-white hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spotify-accent)]"
      >
        {label}
      </Link>
  )
}
