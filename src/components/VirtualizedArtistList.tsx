'use client'

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { type VirtualItem, useWindowVirtualizer } from '@tanstack/react-virtual'

type RenderOptions = {
  shouldRenderHeavy: boolean
}

type IdleCallbackHandle = number
type IdleRequestCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void

export type VirtualizedArtistListHandle = {
  scrollToIndex: (index: number, align?: 'auto' | 'start' | 'center' | 'end') => void
}

type VirtualizedArtistListProps<T> = {
  items: T[]
  renderItem: (item: T, index: number, options: RenderOptions) => React.ReactNode
  getItemKey?: (item: T, index: number) => React.Key
  columnCount?: number
  overscan?: number
  estimateSize?: number
  measureDynamic?: boolean
  progressiveMount?: boolean
  progressiveBatchSize?: number
  className?: string
  rowClassName?: string
}

export function useResponsiveColumns(config: { base: number; sm?: number; lg?: number; xl?: number }) {
  const { base, sm, lg, xl } = config
  const [count, setCount] = useState(base)

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth
      if (xl && width >= 1280) {
        setCount(xl)
        return
      }
      if (lg && width >= 1024) {
        setCount(lg)
        return
      }
      if (sm && width >= 640) {
        setCount(sm)
        return
      }
      setCount(base)
    }

    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [base, sm, lg, xl])

  return count
}

const DEFAULT_ESTIMATE = 72

function getRowItems<T>(items: T[], columnCount: number) {
  if (columnCount === 1) return items.map((item) => [item])
  const rows: T[][] = []
  for (let index = 0; index < items.length; index += columnCount) {
    rows.push(items.slice(index, index + columnCount))
  }
  return rows
}

function addIndicesToQueue(
  queue: number[],
  indices: number[],
  alreadyQueued: Set<number>
) {
  indices.forEach((index) => {
    if (!alreadyQueued.has(index)) {
      alreadyQueued.add(index)
      queue.push(index)
    }
  })
}

const VirtualizedArtistList = React.forwardRef(function VirtualizedArtistListInner<T>(
  {
    items,
    renderItem,
    getItemKey,
    columnCount = 1,
    overscan = 10,
    estimateSize = DEFAULT_ESTIMATE,
    measureDynamic = false,
    progressiveMount = false,
    progressiveBatchSize = 8,
    className,
    rowClassName,
  }: VirtualizedArtistListProps<T>,
  ref: React.ForwardedRef<VirtualizedArtistListHandle>
) {
  const safeColumnCount = Math.max(1, columnCount)
  const parentRef = useRef<HTMLDivElement | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  const rows = useMemo(() => getRowItems(items, safeColumnCount), [items, safeColumnCount])
  const rowCount = rows.length

  useLayoutEffect(() => {
    const updateMargin = () => {
      if (!parentRef.current) return
      const rect = parentRef.current.getBoundingClientRect()
      setScrollMargin(rect.top + window.scrollY)
    }

    updateMargin()
    window.addEventListener('resize', updateMargin)
    return () => window.removeEventListener('resize', updateMargin)
  }, [items.length, safeColumnCount])

  const rowVirtualizer = useWindowVirtualizer({
    count: rowCount,
    overscan,
    estimateSize: () => estimateSize,
    scrollMargin,
  })

  const idleHandle = useRef<IdleCallbackHandle | null>(null)
  const timeoutHandle = useRef<number | null>(null)
  const pendingQueue = useRef<number[]>([])
  const queuedSet = useRef<Set<number>>(new Set())
  const [heavyReady, setHeavyReady] = useState<Set<number>>(new Set())
  const scheduleBatchRef = useRef<() => void>(() => {})

  const cancelScheduled = useCallback(() => {
    const idleWindow = window as Window & {
      cancelIdleCallback?: (handle: IdleCallbackHandle) => void
    }
    if (idleHandle.current !== null && idleWindow.cancelIdleCallback) {
      idleWindow.cancelIdleCallback(idleHandle.current)
      idleHandle.current = null
    }
    if (timeoutHandle.current !== null) {
      window.clearTimeout(timeoutHandle.current)
      timeoutHandle.current = null
    }
  }, [])

  const flushQueue = useCallback(() => {
    if (!pendingQueue.current.length) return
    const batch = pendingQueue.current.splice(0, progressiveBatchSize)
    if (!batch.length) return

    setHeavyReady((previous) => {
      const next = new Set(previous)
      batch.forEach((index) => next.add(index))
      return next
    })

    if (pendingQueue.current.length) {
      scheduleBatchRef.current()
    }
  }, [progressiveBatchSize])

  const scheduleBatch = useCallback(() => {
    if (!progressiveMount) return
    if (idleHandle.current !== null || timeoutHandle.current !== null) return

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback) => IdleCallbackHandle
    }

    if (idleWindow.requestIdleCallback) {
      idleHandle.current = idleWindow.requestIdleCallback(() => {
        idleHandle.current = null
        flushQueue()
      })
      return
    }

    timeoutHandle.current = window.setTimeout(() => {
      timeoutHandle.current = null
      flushQueue()
    }, 0)
  }, [flushQueue, progressiveMount])

  useEffect(() => {
    scheduleBatchRef.current = scheduleBatch
  }, [scheduleBatch])

  useEffect(() => {
    if (!progressiveMount) {
      setHeavyReady(new Set())
      pendingQueue.current = []
      queuedSet.current = new Set()
      cancelScheduled()
      return
    }

    setHeavyReady(new Set())
    pendingQueue.current = []
    queuedSet.current = new Set()
    cancelScheduled()
  }, [items, safeColumnCount, progressiveMount, cancelScheduled])

  const virtualItems = rowVirtualizer.getVirtualItems()

  useEffect(() => {
    if (!progressiveMount) return
    if (!virtualItems.length) return

    const indices: number[] = []
    virtualItems.forEach((virtualItem) => {
      const rowStart = virtualItem.index * safeColumnCount
      const rowItems = rows[virtualItem.index] ?? []
      rowItems.forEach((_, offset) => indices.push(rowStart + offset))
    })

    addIndicesToQueue(pendingQueue.current, indices, queuedSet.current)
    scheduleBatch()
  }, [progressiveMount, rows, safeColumnCount, scheduleBatch, virtualItems])

  useEffect(() => cancelScheduled, [cancelScheduled])

  React.useImperativeHandle(ref, () => ({
    scrollToIndex: (index, align = 'auto') => {
      const rowIndex = Math.floor(index / safeColumnCount)
      rowVirtualizer.scrollToIndex(rowIndex, { align })
    },
  }))

  const renderRowItems = useCallback(
    (row: T[], rowIndex: number) => {
      return row.map((item, offset) => {
        const itemIndex = rowIndex * safeColumnCount + offset
        const key = getItemKey ? getItemKey(item, itemIndex) : itemIndex
        const shouldRenderHeavy = !progressiveMount || heavyReady.has(itemIndex)
        return (
          <React.Fragment key={key}>
            {renderItem(item, itemIndex, { shouldRenderHeavy })}
          </React.Fragment>
        )
      })
    },
    [getItemKey, heavyReady, progressiveMount, renderItem, safeColumnCount]
  )

  return (
    <div ref={parentRef} className={className}>
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow: VirtualItem) => {
          const row = rows[virtualRow.index]
          if (!row) return null
          return (
            <div
              key={virtualRow.key}
              ref={measureDynamic ? rowVirtualizer.measureElement : undefined}
              data-index={virtualRow.index}
              className={rowClassName}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start - scrollMargin}px)`,
              }}
            >
              {renderRowItems(row, virtualRow.index)}
            </div>
          )
        })}
      </div>
    </div>
  )
}) as <T>(
  props: VirtualizedArtistListProps<T> & React.RefAttributes<VirtualizedArtistListHandle>
) => React.ReactElement | null

;(VirtualizedArtistList as React.ForwardRefExoticComponent<
  React.PropsWithoutRef<VirtualizedArtistListProps<unknown>> &
    React.RefAttributes<VirtualizedArtistListHandle>
>).displayName = 'VirtualizedArtistList'

export default VirtualizedArtistList
