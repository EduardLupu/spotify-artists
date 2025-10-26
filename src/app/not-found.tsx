import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, Compass, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020202] text-white">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-40 top-24 h-[26rem] w-[26rem] rounded-full bg-emerald-400/12 blur-3xl" />
        <div className="absolute right-[-10rem] bottom-20 h-[28rem] w-[28rem] rounded-full bg-cyan-400/10 blur-[200px]" />
        <div className="absolute inset-x-0 top-0 h-[45vh] bg-gradient-to-b from-emerald-500/15 via-transparent to-black" />
        <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black via-black/70 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-24 text-center">
        <div className="relative">
          <div className="absolute -inset-12 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/15 bg-white/10 shadow-[0_0_80px_rgba(16,185,129,0.22)] backdrop-blur">
            <Compass className="h-11 w-11 text-emerald-300" />
          </div>
        </div>

        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-[11px] uppercase tracking-[0.32em] text-white/60">
          <Sparkles className="h-3.5 w-3.5 text-emerald-200" />
          Off the charts
        </div>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Lost in the Soundscape
        </h1>
        <p className="mt-4 max-w-3xl text-base text-white/65 sm:text-lg">
          The page you were following slipped out of the Top 500. Let&apos;s guide you back to the live data
          pulse or explore other corners of the chart universe.
        </p>

       <div className="mt-10 grid w-full max-w-3xl gap-4 text-left sm:grid-cols-2">
         <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
           <p className="text-sm font-semibold text-white/80">World&apos;s Top Artists</p>
           <p className="mt-2 text-sm text-white/55">
             Dive into the live global leaderboard with momentum, growth, and audience metrics updated daily.
           </p>
         </div>
         <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
           <p className="text-sm font-semibold text-white/80">Former Artists Archive</p>
           <p className="mt-2 text-sm text-white/55">
             Track the stars who recently left the rankings and see when they last appeared in the Top 500.
           </p>
         </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm font-semibold text-white/80">Artist Constellation</p>
            <p className="mt-2 text-sm text-white/55">
              Explore the interactive 3D network of Top 500 artists and discover their closest relations.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
          <Button
            asChild
            variant="secondary"
            className="group h-12 rounded-full border-white/15 bg-emerald-400/20 px-6 text-sm font-semibold text-white hover:bg-emerald-400/30"
          >
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4 text-white/70 transition-transform group-hover:-translate-x-1" />
              Back to dashboard
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="group h-12 rounded-full border border-white/10 bg-white/5 px-6 text-sm text-white/80 hover:bg-white/10"
          >
            <Link href="/former">
              Explore former artists
              <ArrowUpRight className="ml-2 h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="group h-12 rounded-full border border-white/10 bg-white/5 px-6 text-sm text-white/80 hover:bg-white/10"
          >
            <Link href="/graph">
              Visit artist graph
              <ArrowUpRight className="ml-2 h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
