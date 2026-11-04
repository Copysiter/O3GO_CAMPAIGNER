'use client'

import { useEffect, useRef, useState } from 'react'

// Only column priority depends on measured width. CSS owns all table sizing and
// the browser owns scrolling, touch momentum and scroll chaining.
export function useTableViewport() {
  const stageRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width)
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  return { stageRef, width }
}
