'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { WorldAtlas } from '@/components/world-atlas'

export default function WorldMapPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030303] text-white">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 top-10 h-[28rem] w-[28rem] rounded-full bg-emerald-500/10 blur-[160px]" />
        <div className="absolute right-0 top-1/3 h-[32rem] w-[32rem] rounded-full bg-cyan-500/10 blur-[200px]" />
        <div className="absolute inset-x-0 bottom-0 h-96 bg-gradient-to-t from-black via-black/60 to-transparent" />
      </div>

      <main className="relative mx-auto w-full px-4 pb-24 pt-16 sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/50">Global coverage</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Listener Atlas
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-white/60 sm:text-base">
                Visualise where the top artists resonate the most. Each marker represents an urban epicentre ranked by
                native listener counts and contextualised against the artist’s global scale.
              </p>
            </div>
            <Button
              asChild
              variant="secondary"
              className="w-full rounded-full border-white/10 bg-white/10 text-white hover:bg-white/20 sm:w-auto"
            >
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to dashboard
              </Link>
            </Button>
          </div>

          <WorldAtlas />
        </div>
      </main>
    </div>
  )
}
