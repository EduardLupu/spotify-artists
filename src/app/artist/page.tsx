import { Suspense } from 'react'
import ArtistPage from "@/app/artist/ArtistClient";
import {Loader2} from "lucide-react";

export default function Page() {
  return (
      <Suspense
          fallback={
              <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white/70">
                  <div
                      className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-6 py-3">
                      <Loader2 className="h-5 w-5 animate-spin text-emerald-400"/>
                      Loading artist data...
                  </div>
              </div>
          }
      >
          <ArtistPage/>
      </Suspense>
  )
}
