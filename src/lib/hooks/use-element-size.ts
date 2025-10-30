import { useState, useEffect, type RefObject } from 'react'

type Size = {
  width: number
  height: number
}

export function useElementSize(ref: RefObject<HTMLElement>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    if (!ref.current) return

    const updateSize = () => {
      const rect = ref.current?.getBoundingClientRect()
      if (!rect) return

      setSize({
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      })
    }

    // Initial size
    updateSize()

    // Set up ResizeObserver
    let frameId: number
    const observer = new ResizeObserver(() => {
      // Debounce with requestAnimationFrame
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(updateSize)
    })

    observer.observe(ref.current)

    return () => {
      cancelAnimationFrame(frameId)
      observer.disconnect()
    }
  }, [ref])

  return size
}
