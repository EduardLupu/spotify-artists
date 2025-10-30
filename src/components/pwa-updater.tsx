'use client'

import { useEffect, useRef, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PwaUpdater() {
  const [updateReady, setUpdateReady] = useState(false)
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const waitingWorker = useRef<ServiceWorker | null>(null)
  const reloadingRef = useRef(false)

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    let mounted = true

    const onControllerChange = () => {
      if (reloadingRef.current) return
      reloadingRef.current = true
      window.location.reload()
    }

    const registerServiceWorker = async () => {
      try {
        const nextData = (window as any).__NEXT_DATA__
        const assetPrefix = typeof nextData?.assetPrefix === 'string' ? nextData.assetPrefix : ''
        const prefix = assetPrefix && assetPrefix.endsWith('/') ? assetPrefix.slice(0, -1) : assetPrefix
        const swUrl = `${prefix}/sw.js`
        const registration = await navigator.serviceWorker.register(swUrl)

        if (!mounted) return

        if (registration.waiting) {
          waitingWorker.current = registration.waiting
          setUpdateReady(true)
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              waitingWorker.current = registration.waiting
              setUpdateReady(true)
            }
          })
        })

        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
      } catch (error) {
        console.error('Service worker registration failed', error)
      }
    }

    registerServiceWorker()

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallPromptEvent(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    return () => {
      mounted = false
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  const handleUpdate = () => {
    if (!waitingWorker.current) return
    waitingWorker.current.postMessage({ type: 'SKIP_WAITING' })
    setUpdateReady(false)
  }

  const handleInstall = async () => {
    if (!installPromptEvent) return
    installPromptEvent.prompt()
    const choice = await installPromptEvent.userChoice
    if (choice.outcome === 'accepted') {
      setInstallPromptEvent(null)
    }
  }

  return (
    <>
      {installPromptEvent && (
        <button
          onClick={handleInstall}
          className="fixed bottom-6 left-6 z-50 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-xs font-semibold text-white/80 shadow-lg shadow-black/40 backdrop-blur transition hover:bg-white/15"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Install app
        </button>
      )}

      {updateReady && (
        <div className="fixed bottom-6 right-6 z-50 flex max-w-xs items-center gap-3 rounded-full border border-white/15 bg-black/75 px-4 py-3 text-sm text-white shadow-lg shadow-black/40 backdrop-blur">
          <div>
            <p className="font-semibold text-white">Update available</p>
            <p className="text-xs text-white/70">A new version is ready. Refresh to stay in sync.</p>
          </div>
          <button
            onClick={handleUpdate}
            className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-black transition hover:bg-emerald-400"
          >
            Refresh
          </button>
        </div>
      )}
    </>
  )}
