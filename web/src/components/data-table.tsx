'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Ellipsis,
  Filter as FilterIcon,
  RefreshCw,
  Rows3,
  Check,
  LoaderCircle,
  Plus,
} from 'lucide-react'
import { api, type Row, type PageData } from '@/lib/api'
import { serializeQuery, allowedOperators, type Filter } from '@/lib/filters'
import type { Resource, Column } from '@/lib/resources'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { useI18n } from '@/lib/i18n'
import { useTableViewport } from './use-table-viewport'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from './ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from './ui/context-menu'
import { ErrorBox, Modal, Value } from './common'
import { usePreferences } from './providers'
import { FilterBar } from './filters'
export type Action = {
  key: string
  label: string
  danger?: boolean
  disabled?: boolean
}
export type TableSummary = { total: number; visible: number; selected: number }
const entityNames: Record<string, string> = {
  campaigns: 'Кампания',
  tags: 'Тег',
  keys: 'API-ключ',
  users: 'Пользователь',
  android: 'Устройство',
  versions: 'Версия',
  accounts: 'Аккаунт',
}
export function DataTable({
  resource,
  onAction,
  actions = [],
  bulkActions = [],
  onOpen,
  refreshKey = 0,
  createAction,
  onSummaryChange,
}: {
  resource: Resource
  onAction?: (action: string, rows: Row[]) => void
  actions?: Action[]
  bulkActions?: Action[]
  onOpen?: (row: Row) => void
  refreshKey?: number
  createAction?: { label: string; onClick: () => void }
  onSummaryChange?: (summary: TableSummary) => void
}) {
  const { preferences } = usePreferences()
  const { t, locale } = useI18n()
  const viewport = useTableViewport()
  const messages = resource.key.startsWith('messages-')
  const entityName = messages ? t('Сообщение') : t(entityNames[resource.key] || resource.singular)
  const pageSizes = messages ? [100, 250, 500, 1000] : [20, 50, 100, 250, 500, 1000]
  const [modePreference, setModePreference] = useState<'auto' | 'compact' | 'scroll'>(
    preferences.tableMode,
  )
  const [mobile, setMobile] = useState(false)
  const mode = modePreference === 'auto' ? (mobile ? 'compact' : 'scroll') : modePreference
  const [filters, setFilters] = useState<Filter[]>([]),
    [sorting, setSorting] = useState<SortingState>([{ id: 'id', desc: !messages }])
  const [page, setPage] = useState(0),
    [size, setSize] = useState(messages ? 100 : 20),
    [selection, setSelection] = useState<RowSelectionState>({})
  const [details, setDetails] = useState<Row | null>(null),
    [editor, setEditor] = useState<{ filter?: Filter; index?: number } | null>(null)
  const [hidden, setHidden] = useState<string[]>(messages ? ['id'] : []),
    [compactKeys, setCompactKeys] = useState<string[]>(
      resource.columns.filter((c) => c.primary).map((c) => c.key),
    )
  const contextPointerStarted = useRef(false)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    const keys = resource.columns.map((column) => column.key)
    const defaults = resource.columns.filter((column) => column.primary).map((column) => column.key)
    let nextMode: 'auto' | 'compact' | 'scroll' = preferences.tableMode
    let nextHidden: string[] = messages ? ['id'] : []
    let nextCompact = defaults.length ? defaults : keys.slice(0, 3)
    try {
      const p = JSON.parse(localStorage.getItem(`table:${resource.key}`) || 'null')
      if (p) {
        if (p.mode === 'auto' || p.mode === 'scroll' || p.mode === 'compact') nextMode = p.mode
        if (Array.isArray(p.hidden))
          nextHidden = [...new Set<string>(p.hidden.filter((key: string) => keys.includes(key)))]
        if (Array.isArray(p.compactKeys)) {
          const saved = [
            ...new Set<string>(p.compactKeys.filter((key: string) => keys.includes(key))),
          ]
          if (saved.length) nextCompact = saved
        }
      }
      if (messages && p?.version !== 2) {
        nextHidden = [...new Set([...nextHidden, 'id'])]
        localStorage.setItem(
          `table:${resource.key}`,
          JSON.stringify({
            ...(p && typeof p === 'object' ? p : {}),
            version: 2,
            hidden: nextHidden,
          }),
        )
      }
    } catch {}
    setModePreference(nextMode)
    setHidden(nextHidden.length < keys.length ? nextHidden : messages ? ['id'] : [])
    setCompactKeys(nextCompact)
  }, [resource.key, preferences.tableMode])
  const changeMode = (value: 'auto' | 'compact' | 'scroll') => {
    setModePreference(value)
    saveColumns(value, hidden, compactKeys)
  }
  const saveColumns = (
    nextMode: 'auto' | 'compact' | 'scroll',
    nextHidden: string[],
    nextCompact: string[],
  ) => {
    try {
      localStorage.setItem(
        `table:${resource.key}`,
        JSON.stringify({
          version: 2,
          mode: nextMode,
          hidden: nextHidden,
          compactKeys: nextCompact,
        }),
      )
    } catch {}
  }
  const query = serializeQuery(filters, sorting, page, size, resource.key === 'campaigns')
  const data = useQuery<PageData>({
    queryKey: ['rows', resource.endpoint, query, refreshKey],
    queryFn: ({ signal }) => api(`${resource.endpoint}?${query}`, { signal }),
    placeholderData: keepPreviousData,
    refetchInterval:
      messages || ['campaigns', 'android', 'accounts'].includes(resource.key) ? 60000 : false,
  })
  const [foregroundQuery, setForegroundQuery] = useState<string | null>(null)
  const showLoading = data.isPending || (data.isFetching && foregroundQuery === query)
  const staleRows = data.isPlaceholderData || showLoading || !!data.error
  const requestForeground = (
    nextFilters = filters,
    nextSorting = sorting,
    nextPage = page,
    nextSize = size,
  ) =>
    setForegroundQuery(
      serializeQuery(nextFilters, nextSorting, nextPage, nextSize, resource.key === 'campaigns'),
    )
  useEffect(() => {
    if (foregroundQuery && (!data.isFetching || foregroundQuery !== query)) setForegroundQuery(null)
  }, [foregroundQuery, data.isFetching, query])
  useEffect(() => {
    setSelection({})
  }, [query])
  useEffect(() => {
    if (data.data && page > 0 && page * size >= data.data.total)
      setPage(Math.max(0, Math.ceil(data.data.total / size) - 1))
  }, [data.data?.total, page, size])
  useEffect(() => {
    if (!data.data || data.isPlaceholderData) return
    const ids = new Set(data.data.data.map((row) => String(row.id)))
    setSelection((selected) => {
      const next = Object.fromEntries(
        Object.entries(selected).filter(([id, checked]) => checked && ids.has(id)),
      )
      return Object.keys(next).length === Object.keys(selected).length ? selected : next
    })
  }, [data.data, data.isPlaceholderData])
  const eligible = resource.columns.filter((c) => !hidden.includes(c.key))
  const compactLimit =
    viewport.width < 260 ? 1 : viewport.width < 560 ? 2 : viewport.width < 900 ? 3 : 5
  const compact = compactKeys
    .map((key) => resource.columns.find((c) => c.key === key))
    .filter((c): c is Column => !!c)
  const kindOf = (column: Column) =>
    column.key === 'id' || column.key === 'dst_addr' || column.key === 'ext_id'
      ? 'identifier'
      : column.choices || ['enum', 'campaign-status', 'boolean'].includes(column.type || '')
        ? 'status'
        : column.type === 'number' && column.key !== 'user_id'
          ? 'number'
          : 'text'
  const available = Math.max(1, viewport.width - 96)
  const samples = data.data?.data.slice(0, 50) || []
  const compactMetrics = compact.slice(0, compactLimit).map((column) => {
    const kind = kindOf(column)
    const lengths = samples.map((row) => {
      const value = column.key === 'user_id' ? (row.user?.name ?? row.user_id) : row[column.key]
      const choice = column.choices?.find(([key]) => String(key) === String(value))?.[1]
      const label = choice
        ? t(choice)
        : kind === 'number' && value != null && Number.isFinite(Number(value))
          ? Number(value).toLocaleString(locale)
          : String(value ?? '')
      return label.length
    })
    const characters = Math.max(1, ...lengths)
    const width =
      column.key === 'id'
        ? 64
        : kind === 'number'
          ? Math.max(60, characters * 7 + 20)
          : kind === 'status'
            ? Math.min(180, Math.max(72, characters * 6.5 + 24))
            : kind === 'identifier'
              ? Math.max(96, characters * 7 + 20)
              : 64
    return {
      column,
      width,
      flexible: kind === 'text',
      weight: Math.min(3, Math.max(1, characters / 12)),
    }
  })
  // Keep numeric/status/identifier values intact. Lower-priority columns move
  // into the row details when their readable minima no longer fit.
  while (
    compactMetrics.length > 1 &&
    compactMetrics.reduce((sum, metric) => sum + metric.width, 0) > available
  )
    compactMetrics.pop()
  const displayed = mode === 'scroll' ? eligible : compactMetrics.map(({ column }) => column)
  const compactWidths = new Map<string, number>()
  if (mode === 'compact' && compactMetrics.length) {
    const total = compactMetrics.reduce((sum, metric) => sum + metric.width, 0)
    const weight = compactMetrics
      .filter((metric) => metric.flexible)
      .reduce((sum, metric) => sum + metric.weight, 0)
    for (const [index, metric] of compactMetrics.entries()) {
      const share = weight ? (metric.flexible ? metric.weight / weight : 0) : index === 0 ? 1 : 0
      compactWidths.set(
        metric.column.key,
        Math.min(available, metric.width + Math.max(0, available - total) * share),
      )
    }
  }
  const openFilter = (column: Column) => {
    const index = filters.findIndex((filter) => filter.field === column.key)
    if (index >= 0) {
      setEditor({ filter: filters[index], index })
      return
    }
    const op = allowedOperators(column.type || 'text')[0]
    setEditor({
      filter: {
        field: column.key,
        operator: op,
        value: op === 'overlaps' ? [] : '',
      },
    })
  }
  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <label className="table-checkbox-hit grid size-11 place-items-center">
            <Checkbox
              aria-label={t('Выбрать строки этой страницы')}
              disabled={staleRows}
              checked={
                table.getIsAllRowsSelected() || (table.getIsSomeRowsSelected() && 'indeterminate')
              }
              onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
              className="table-checkbox size-4"
            />
          </label>
        ),
        cell: ({ row }) => (
          <label className="table-checkbox-hit grid size-11 place-items-center">
            <Checkbox
              aria-label={t('Выбрать строку {id}', { id: row.original.id })}
              checked={row.getIsSelected()}
              disabled={staleRows}
              onCheckedChange={(v) => row.toggleSelected(!!v)}
              className="table-checkbox size-4"
            />
          </label>
        ),
      },
      ...displayed.map((c) => ({
        id: c.key,
        size: c.key === 'id' ? 64 : undefined,
        accessorFn: (row: Row) =>
          c.key === 'user_id' ? (row.user?.name ?? row.user_id) : row[c.key],
        header: ({ column }: any) => (
          <div className={`flex items-center gap-1 ${c.key === 'id' ? 'px-1' : 'px-2'}`}>
            <button
              className="flex min-h-11 min-w-0 items-center gap-1 text-xs md:min-h-9"
              title={
                c.sort === false ? t(c.label) : t('Сортировать: {column}', { column: t(c.label) })
              }
              disabled={c.sort === false}
              onClick={() => {
                const next =
                  column.getIsSorted() === 'asc'
                    ? [{ id: c.key, desc: true }]
                    : [{ id: c.key, desc: false }]
                requestForeground(filters, next, 0)
                setSorting(next)
                setPage(0)
                setSelection({})
              }}
            >
              {t(c.label)}
              {c.sort !== false &&
                (column.getIsSorted() === 'asc' ? (
                  <ArrowUp size={12} />
                ) : column.getIsSorted() === 'desc' ? (
                  <ArrowDown size={12} />
                ) : (
                  <ArrowUpDown size={12} className="opacity-50" />
                ))}
            </button>
            {c.filter !== false && c.key !== 'id' && (
              <Button
                variant="ghost"
                size="icon"
                className={`hidden size-9 shrink-0 sm:inline-flex ${filters.some((filter) => filter.field === c.key) ? 'text-primary' : ''}`}
                aria-label={t('Фильтр: {column}', { column: t(c.label) })}
                onClick={() => openFilter(c)}
              >
                <FilterIcon size={13} />
              </Button>
            )}
          </div>
        ),
        cell: ({ getValue, row }: any) => (
          <div className="table-cell-value table-cell-content min-w-0 text-[13px]">
            {c.key === 'name' || c.key === 'dst_addr' || c.key === 'device_name' ? (
              <button
                className="table-primary-value min-h-11 text-left font-medium text-foreground hover:text-primary"
                onClick={() => (onOpen ? onOpen(row.original) : setDetails(row.original))}
              >
                {String(getValue() || t('Без названия'))}
                {mode === 'compact' && (
                  <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                    #{row.original.id}
                  </span>
                )}
              </button>
            ) : (
              <Value value={getValue()} type={c.type} choices={c.choices} field={c.key} />
            )}
          </div>
        ),
      })),
      {
        id: 'spacer',
        header: () => null,
        cell: () => null,
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('Действия')}</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('Действия строки {id}', { id: row.original.id })}
              >
                <Ellipsis size={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 max-h-[75dvh] overflow-auto">
              <DropdownMenuLabel>
                {t('{entity} #{id}', { entity: entityName, id: row.original.id })}
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setDetails(row.original)}>
                <Rows3 size={16} />
                {t('Все поля и подробности')}
              </DropdownMenuItem>
              {onOpen && (
                <DropdownMenuItem onSelect={() => onOpen(row.original)}>
                  {t('Открыть кампанию')}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {actions.map((a) => (
                <DropdownMenuItem
                  key={a.key}
                  disabled={a.disabled || staleRows}
                  className={a.danger ? 'text-destructive' : ''}
                  onSelect={() => onAction?.(a.key, [row.original])}
                >
                  {t(a.label)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [
      displayed.map((c) => c.key).join(','),
      sorting,
      staleRows,
      filters,
      actions,
      onOpen,
      onAction,
      mode,
      locale,
      t,
      entityName,
      page,
      size,
    ],
  )
  const table = useReactTable({
    data: data.data?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    getRowId: (r) => String(r.id),
    state: { sorting, rowSelection: selection },
    onRowSelectionChange: setSelection,
    enableRowSelection: true,
  })
  const selected = table.getSelectedRowModel().rows.map((r) => r.original)
  const total = data.data?.total ?? 0
  const visibleCount = data.data?.data.length ?? 0
  const hasData = !!data.data
  const selectedCount = selected.length
  const reportedSummary = useRef<TableSummary | null>(null)
  useEffect(() => {
    if (!onSummaryChange || !hasData) return
    const next = { total, visible: visibleCount, selected: selectedCount }
    const previous = reportedSummary.current
    if (
      previous?.total === next.total &&
      previous.visible === next.visible &&
      previous.selected === next.selected
    )
      return
    reportedSummary.current = next
    onSummaryChange(next)
  }, [hasData, total, visibleCount, selectedCount, onSummaryChange])
  const changeFilters = (value: Filter[]) => {
    requestForeground(value, sorting, 0)
    setFilters(value)
    setPage(0)
    setSelection({})
  }
  const columnClass = (id: string) => {
    if (id === 'actions') return 'row-actions'
    if (id === 'select') return 'table-selection-column'
    if (id === 'spacer') return 'table-spacer'
    const column = resource.columns.find((candidate) => candidate.key === id)
    return `table-data-column column-${column ? kindOf(column) : 'text'}${id === 'id' ? ' id-column' : ''}${id === 'tags' ? ' cell-tags' : ''}${id === 'api_keys' || (id === 'value' && resource.key === 'keys') ? ' cell-api-keys' : ''}`
  }
  return (
    <div
      ref={viewport.stageRef}
      className="data-table-stage min-w-0"
      data-mode={mode}
      data-mode-preference={modePreference}
    >
      <div className="table-controls flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <FilterBar
          filters={filters}
          columns={resource.columns}
          onChange={changeFilters}
          editor={editor}
          setEditor={setEditor}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            aria-label={t('Обновить таблицу')}
            disabled={showLoading}
            onClick={() => {
              requestForeground()
              void data.refetch()
            }}
          >
            <RefreshCw size={16} className={showLoading ? 'animate-spin' : ''} />
            <span className="hidden md:inline">{t('Обновить')}</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" aria-label={t('Настроить колонки')}>
                <Columns3 size={16} />
                <span className="hidden sm:inline">{t('Колонки')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[65dvh] w-64 overflow-auto">
              <DropdownMenuLabel>{t('Вид таблицы')}</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => changeMode('auto')}>
                {modePreference === 'auto' && <Check size={16} />}
                {t('Автоматически')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => changeMode('compact')}>
                {modePreference === 'compact' && <Check size={16} />}
                {t('Компактный')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => changeMode('scroll')}>
                {modePreference === 'scroll' && <Check size={16} />}
                {t('Горизонтальная прокрутка')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>
                {mode === 'compact'
                  ? t('Приоритетные колонки · до {count}', { count: compactLimit })
                  : t('Видимые колонки')}
              </DropdownMenuLabel>
              {mode === 'compact' && (
                <p className="px-2 pb-2 text-xs text-muted-foreground">
                  {t('Новая выбранная колонка становится первой. Остальные поля — в ⋯.')}
                </p>
              )}
              {resource.columns.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.key}
                  disabled={
                    mode === 'compact'
                      ? compactKeys.length === 1 && compactKeys.includes(c.key)
                      : eligible.length === 1 && !hidden.includes(c.key)
                  }
                  checked={
                    mode === 'compact' ? compactKeys.includes(c.key) : !hidden.includes(c.key)
                  }
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(checked) => {
                    if (mode === 'compact') {
                      const next = checked
                        ? [c.key, ...compactKeys.filter((k) => k !== c.key)]
                        : compactKeys.filter((k) => k !== c.key)
                      setCompactKeys(next)
                      saveColumns(modePreference, hidden, next)
                    } else {
                      const next = checked ? hidden.filter((k) => k !== c.key) : [...hidden, c.key]
                      setHidden(next)
                      saveColumns(modePreference, next, compactKeys)
                    }
                  }}
                >
                  {t(c.label)}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  const defaults = resource.columns
                    .filter((column) => column.primary)
                    .map((column) => column.key)
                  const next = defaults.length
                    ? defaults
                    : resource.columns.slice(0, 3).map((column) => column.key)
                  const nextHidden = messages ? ['id'] : []
                  setHidden(nextHidden)
                  setCompactKeys(next)
                  saveColumns(modePreference, nextHidden, next)
                }}
              >
                {t('Сбросить колонки')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            aria-label={t('Переключить режим таблицы')}
            aria-pressed={mode === 'scroll'}
            title={
              mode === 'compact'
                ? t('Компактный вид. Переключить на горизонтальную прокрутку')
                : t('Горизонтальная прокрутка. Переключить на компактный вид')
            }
            onClick={() => changeMode(mode === 'compact' ? 'scroll' : 'compact')}
          >
            <Rows3 size={16} />
            <span className="hidden sm:inline">
              {mode === 'compact' ? t('Компактно') : t('Прокрутка')}
            </span>
          </Button>
          {createAction && (
            <Button
              onClick={createAction.onClick}
              aria-label={t(createAction.label)}
              title={t(createAction.label)}
            >
              <Plus size={16} />
              <span className="hidden md:inline">{t(createAction.label)}</span>
            </Button>
          )}
        </div>
      </div>
      {selected.length > 0 && (
        <div className="table-selection flex flex-wrap items-center gap-2 rounded-sm border border-primary/30 bg-card p-3">
          <span className="mr-2 text-sm font-medium">
            {t('Выбрано: {count}', { count: selected.length })}
          </span>
          {bulkActions.map((a) => (
            <Button
              key={a.key}
              variant={a.danger ? 'destructive' : 'outline'}
              disabled={a.disabled || staleRows}
              onClick={() => onAction?.(a.key, selected)}
            >
              {t(a.label)}
            </Button>
          ))}
          <Button variant="ghost" onClick={() => setSelection({})}>
            {t('Снять выбор')}
          </Button>
        </div>
      )}
      {data.error && (
        <div className="table-error">
          <ErrorBox
            error={data.error}
            retry={() => {
              requestForeground()
              void data.refetch()
            }}
          />
        </div>
      )}
      <div className="table-panel panel min-w-0 overflow-hidden">
        <div className="table-summary flex items-center justify-between gap-2 border-b px-4 py-3">
          <span className="text-xs text-muted-foreground">
            {mode === 'compact'
              ? t('{visible} из {total} колонок · остальные в ⋯', {
                  visible: displayed.length,
                  total: resource.columns.length,
                })
              : t('Прокрутите таблицу влево или вправо')}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {t('{count} записей', { count: data.data?.total.toLocaleString(locale) ?? '—' })}
          </span>
        </div>
        <div className="table-viewport" aria-busy={showLoading}>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label={t('{resource}: таблица с прокруткой', { resource: t(resource.title) })}
          >
            <table
              aria-busy={showLoading}
              className={`data-table ${mode === 'scroll' ? 'full-table' : ''}`}
            >
              <caption className="sr-only">
                {t('{resource}. Выбор строк, сортировка и действия через меню каждой строки.', {
                  resource: t(resource.title),
                })}
              </caption>
              <colgroup>
                {table.getVisibleLeafColumns().map((column) => (
                  <col
                    key={column.id}
                    className={columnClass(column.id)}
                    style={
                      compactWidths.has(column.id)
                        ? { width: compactWidths.get(column.id) }
                        : undefined
                    }
                  />
                ))}
              </colgroup>
              <thead className="table-head">
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => (
                      <th
                        key={header.id}
                        scope="col"
                        className={columnClass(header.column.id)}
                        data-column-id={header.column.id}
                        aria-hidden={header.column.id === 'spacer' || undefined}
                        data-no-interaction={header.column.id === 'spacer' || undefined}
                        style={
                          header.column.id === 'id'
                            ? { width: 64, minWidth: 64, maxWidth: 64 }
                            : undefined
                        }
                        aria-sort={
                          header.column.getIsSorted() === 'asc'
                            ? 'ascending'
                            : header.column.getIsSorted() === 'desc'
                              ? 'descending'
                              : undefined
                        }
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="table-body">
                {table.getRowModel().rows.map((row) => (
                  <ContextMenu
                    key={row.id}
                    onOpenChange={(open) => {
                      if (open) contextPointerStarted.current = false
                    }}
                  >
                    <ContextMenuTrigger asChild>
                      <tr data-selected={row.getIsSelected()} aria-selected={row.getIsSelected()}>
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            style={
                              cell.column.id === 'id'
                                ? { width: 64, minWidth: 64, maxWidth: 64 }
                                : undefined
                            }
                            className={`${columnClass(cell.column.id)}${cell.column.id === 'select' ? ' !p-0' : ''}`}
                            data-column-id={cell.column.id}
                            aria-hidden={cell.column.id === 'spacer' || undefined}
                            data-no-interaction={cell.column.id === 'spacer' || undefined}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    </ContextMenuTrigger>
                    <ContextMenuContent
                      className="w-60 max-h-[75dvh] overflow-auto"
                      onPointerDownCapture={(e) => {
                        contextPointerStarted.current = e.button === 0
                      }}
                      onPointerUpCapture={(e) => {
                        if (!contextPointerStarted.current || e.button !== 0) {
                          e.preventDefault()
                          e.stopPropagation()
                        }
                      }}
                    >
                      <ContextMenuLabel>
                        {t('{entity} #{id}', { entity: entityName, id: row.original.id })}
                      </ContextMenuLabel>
                      <ContextMenuItem onSelect={() => setDetails(row.original)}>
                        {t('Все поля и подробности')}
                      </ContextMenuItem>
                      {onOpen && (
                        <ContextMenuItem onSelect={() => onOpen(row.original)}>
                          {t('Открыть кампанию')}
                        </ContextMenuItem>
                      )}
                      <ContextMenuItem disabled={staleRows} onSelect={() => row.toggleSelected()}>
                        {t('Выбрать / снять выбор')}
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      {actions.map((a) => (
                        <ContextMenuItem
                          key={a.key}
                          disabled={a.disabled || staleRows}
                          className={a.danger ? 'text-destructive' : ''}
                          onSelect={() => onAction?.(a.key, [row.original])}
                        >
                          {t(a.label)}
                        </ContextMenuItem>
                      ))}
                      {row.getIsSelected() && selected.length > 1 && bulkActions.length > 0 && (
                        <>
                          <ContextMenuSeparator />
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            {t('Выбрано: {count}', { count: selected.length })}
                          </div>
                          {bulkActions.map((action) => (
                            <ContextMenuItem
                              key={`bulk-${action.key}`}
                              disabled={action.disabled || staleRows}
                              className={action.danger ? 'text-destructive' : ''}
                              onSelect={() => onAction?.(action.key, selected)}
                            >
                              {t(action.label)}
                            </ContextMenuItem>
                          ))}
                        </>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </tbody>
            </table>
            {!table.getRowModel().rows.length && !data.isPending && (
              <div className="p-12 text-center">
                <Rows3 className="mx-auto mb-3 text-muted-foreground" />
                <p>{t('Нет записей')}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('Измените фильтры или добавьте первую запись.')}
                </p>
              </div>
            )}
          </div>
          {showLoading && (
            <div className="table-loading-overlay" role="status" aria-live="polite">
              <div className="flex items-center gap-3 border bg-card px-5 py-3 text-sm shadow-lg">
                <LoaderCircle className="animate-spin text-primary" size={20} />
                {t('Загрузка...')}
              </div>
            </div>
          )}
        </div>
        <div className="table-pagination flex flex-wrap items-center justify-between gap-3 border-t p-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {t('Строк')}
            <select
              className="native-select"
              aria-label={t('Строк на странице')}
              value={size}
              disabled={showLoading}
              onChange={(e) => {
                const next = Number(e.target.value)
                requestForeground(filters, sorting, 0, next)
                setSize(next)
                setPage(0)
              }}
            >
              {pageSizes.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <span
            className="hidden text-xs tabular-nums text-muted-foreground sm:block"
            aria-live="polite"
          >
            {data.data?.total
              ? t('{from}–{to} из {total}', {
                  from: page * size + 1,
                  to: Math.min((page + 1) * size, data.data.total),
                  total: data.data.total.toLocaleString(locale),
                })
              : t('0 записей')}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label={t('Предыдущая страница')}
              disabled={page === 0 || showLoading}
              onClick={() => {
                requestForeground(filters, sorting, page - 1)
                setPage(page - 1)
              }}
            >
              <ChevronLeft size={18} />
            </Button>
            <span className="text-xs tabular-nums">
              {page + 1} / {Math.max(1, Math.ceil((data.data?.total || 0) / size))}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('Следующая страница')}
              disabled={(page + 1) * size >= (data.data?.total || 0) || showLoading}
              onClick={() => {
                requestForeground(filters, sorting, page + 1)
                setPage(page + 1)
              }}
            >
              <ChevronRight size={18} />
            </Button>
          </div>
        </div>
      </div>
      {details && (
        <Modal
          open
          title={t('{entity} · #{id}', { entity: entityName, id: details.id })}
          className="record-detail-modal"
          bodyClassName="record-detail-body"
          description={t('Все поля строки, включая скрытые в компактном режиме.')}
          onOpenChange={(v) => !v && setDetails(null)}
          footer={<Button onClick={() => setDetails(null)}>{t('Закрыть')}</Button>}
        >
          <dl className="record-detail-list">
            {resource.columns.map((c) => (
              <div key={c.key} className="record-detail-field grid gap-1">
                <dt className="text-xs text-muted-foreground">{t(c.label)}</dt>
                <dd className="break-words whitespace-pre-wrap text-sm">
                  <Value
                    value={
                      c.key === 'user_id' ? (details.user?.name ?? details.user_id) : details[c.key]
                    }
                    type={c.type}
                    choices={c.choices}
                    field={c.key}
                  />
                </dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
    </div>
  )
}
