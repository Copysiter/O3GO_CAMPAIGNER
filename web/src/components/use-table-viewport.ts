'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Row } from '@/lib/api'
import type { Column } from '@/lib/resources'

export function useTableViewport(
  compact: boolean,
  priorities: string[],
  resourceColumns: Column[],
  rows: Row[] | undefined,
  locale: string,
) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    const update = () => setWidth(scroll.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(scroll)
    return () => observer.disconnect()
  }, [])

  const compactLimit = width < 260 ? 1 : width < 560 ? 2 : width < 900 ? 3 : 5
  const candidates = useMemo(() => priorities
    .map(key => resourceColumns.find(column => column.key === key))
    .filter((column): column is Column => !!column)
    .slice(0, compactLimit), [priorities, resourceColumns, compactLimit])

  // Measure all candidates again when the labels, data or available space change.
  const inputs = useMemo(() => ({ candidates, width, rows, locale, compact }), [candidates, width, rows, locale, compact])
  const [layout, setLayout] = useState<{
    inputs: typeof inputs
    count: number
    widths: Map<string, number>
  }>()
  const measuring = compact && layout?.inputs !== inputs

  useLayoutEffect(() => {
    const table = tableRef.current
    const scroll = scrollRef.current
    if (!measuring || !table?.tHead || !scroll) return
    const head = table.tHead.rows[0]
    const cells = Array.from(head.cells)
    const selection = cells[0].getBoundingClientRect().width
    const actions = cells[cells.length - 1].getBoundingClientRect().width
    let remaining = scroll.clientWidth - selection - actions
    const metrics: { key: string; minimum: number; natural: number }[] = []
    for (const cell of cells.slice(1, -1)) {
      const natural = Math.ceil(cell.getBoundingClientRect().width)
      const heading = cell.querySelector<HTMLElement>('.table-header-controls')!
      const column = candidates[cell.cellIndex - 1]
      const canWrap = cell.classList.contains('column-text') && column.type !== 'date'
      const headerWidth = Math.ceil(heading.getBoundingClientRect().width)
      const minimum = canWrap ? Math.min(natural, Math.max(64, headerWidth)) : natural
      if (metrics.length && minimum > remaining) break
      metrics.push({ key: column.key, minimum, natural })
      remaining -= minimum
    }

    // Keep space for each visible heading and its controls. Earlier text columns
    // can wrap; the last visible column has no width set and fills the table.
    const widths = new Map<string, number>()
    for (const metric of metrics.slice(0, -1)) {
      const extra = Math.min(Math.max(0, remaining), metric.natural - metric.minimum)
      widths.set(metric.key, metric.minimum + extra)
      remaining -= extra
    }
    setLayout({ inputs, count: metrics.length, widths })
  }, [inputs, measuring, candidates])

  return {
    scrollRef, tableRef, compactLimit, measuring,
    columns: measuring ? candidates : candidates.slice(0, layout?.count),
    compactWidths: compact && !measuring && layout ? layout.widths : undefined,
  }
}
