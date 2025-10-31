'use client'

import {Globe2} from 'lucide-react'
import { WorldAtlas } from '@/components/world-atlas'
import Navbar from "@/components/navbar";

export default function WorldMapClient() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030303] text-white">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 top-10 h-[28rem] w-[28rem] rounded-full bg-emerald-500/10 blur-[160px]" />
        <div className="absolute right-0 top-1/3 h-[32rem] w-[32rem] rounded-full bg-cyan-500/10 blur-[200px]" />
        <div className="absolute inset-x-0 bottom-0 h-96 bg-gradient-to-t from-black via-black/60 to-transparent" />
      </div>

        <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl w-full px-4 sm:px-6 lg:px-10">
            <div className="mx-auto px-4 py-10">
                <div className="flex flex-col gap-8">
                    <div className="flex items-center justify-between">
                        <div className="inline-flex h-6 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.35em] text-white/60">
                            <Globe2 className="h-3.5 w-3.5 text-emerald-300" />
                            Global coverage
                        </div>
                        <Navbar />
                    </div>
                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between py-7">
                        <div className="space-y-2">
                            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">World Atlas</h1>
                            <p className="max-w-2xl text-sm text-white/60 sm:text-base">
                                Visualise where the top artists resonate the most. Each marker represents an urban epicentre ranked by
                                native listener counts and contextualised against the artist’s global scale.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </header>
      <main className="relative mx-auto w-full px-4 pb-24 pt-16 sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full flex-col gap-8">
          <WorldAtlas />
        </div>
      </main>
    </div>
  )
}
