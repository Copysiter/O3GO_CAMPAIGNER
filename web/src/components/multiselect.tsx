'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown, Plus, RotateCcw } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useI18n } from '@/lib/i18n'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Input } from './ui/input'
import styles from './multiselect.module.css'

type Value = string | number
type Props = {
  id?: string
  label: string
  searchLabel: string
  options: { value: Value; text: string }[]
  value: Value[]
  onChange: (next: Value[]) => void
  loading?: boolean
  disabled?: boolean
  onCreate?: (query: string) => Promise<boolean>
}

export function MultiSelect({
  id, label, searchLabel, options, value, onChange, loading, disabled, onCreate,
}: Props) {
  const { t, locale } = useI18n()
  const countId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const search = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const openAtPress = useRef<boolean | null>(null)
  const focusSearchOnOpen = useRef(true)
  const restoringFocus = useRef(false)

  const selected = new Set(value.map(String))
  const available = useMemo(() => {
    const byId = new Map(options.map(option => [String(option.value), option]))
    for (const id of value) {
      if (!byId.has(String(id))) byId.set(String(id), { value: id, text: String(id) })
    }
    return Array.from(byId.values())
  }, [options, value])
  const term = query.trim()
  const folded = term.toLocaleLowerCase(locale)
  const filtered = available.filter(option => option.text.toLocaleLowerCase(locale).includes(folded))
  const canCreate = onCreate && term && !available.some(option => String(option.value) === term)

  function changeOpen(next: boolean) {
    setOpen(next)
    if (!next) setQuery('')
  }

  useEffect(() => {
    if (disabled) changeOpen(false)
  }, [disabled])

  function navigateOptions(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role="checkbox"]:enabled') ?? [])
    const index = buttons.indexOf(event.target as HTMLButtonElement)
    if (index === -1 && event.target !== search.current) return
    event.preventDefault()
    if (event.key === 'ArrowDown') buttons[Math.min(index + 1, buttons.length - 1)]?.focus()
    else if (index > 0) buttons[index - 1].focus()
    else search.current?.focus()
  }

  async function create() {
    if (!onCreate || !canCreate || creating) return
    setCreating(true)
    try {
      if (await onCreate(term)) setQuery(current => current.trim() === term ? '' : current)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Popover.Root open={open && !disabled} onOpenChange={changeOpen}>
      <Popover.Trigger
        id={id}
        className={styles.trigger}
        data-slot="multiselect-trigger"
        disabled={disabled}
        aria-label={label}
        aria-describedby={countId}
        onPointerDown={event => {
          if (event.button === 0) {
            openAtPress.current = open
            if (!open) focusSearchOnOpen.current = event.pointerType !== 'touch'
          }
        }}
        onPointerCancel={() => {
          openAtPress.current = null
          focusSearchOnOpen.current = true
        }}
        onFocus={() => {
          if (!restoringFocus.current) changeOpen(true)
        }}
        onClick={event => {
          // The press that focused a closed trigger also generates a click after it opens.
          event.preventDefault()
          const wasOpen = openAtPress.current
          openAtPress.current = null
          if (event.detail === 0) changeOpen(!open)
          else changeOpen(wasOpen === null || !wasOpen)
        }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            changeOpen(true)
            search.current?.focus()
          }
        }}
      >
        <Badge id={countId} variant="outline" className={styles.count} data-active={selected.size > 0}>
          {t('Выбрано: {count}', { count: selected.size })}
        </Badge>
        <ChevronDown size={14} aria-hidden className={styles.chevron} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={`form-surface ${styles.popup}`}
          data-slot="multiselect-content"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          hideWhenDetached
          aria-label={label}
          onOpenAutoFocus={event => {
            event.preventDefault()
            // Touch users can select a row without raising the software keyboard.
            if (focusSearchOnOpen.current) search.current?.focus({ preventScroll: true })
            focusSearchOnOpen.current = true
          }}
          onCloseAutoFocus={() => {
            // Radix restores focus on Escape and leaves an outside click's target focused.
            restoringFocus.current = true
            queueMicrotask(() => { restoringFocus.current = false })
          }}
          onKeyDown={navigateOptions}
        >
          <div className={styles.tools}>
            <Input
              ref={search}
              aria-label={searchLabel}
              placeholder={t('Найти значение…')}
              autoComplete="off"
              value={query}
              onChange={event => {
                setQuery(event.target.value)
                if (list.current) list.current.scrollTop = 0
              }}
            />
            {value.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={creating}
                aria-label={t('Сбросить')}
                title={t('Сбросить')}
                onClick={() => onChange([])}
              >
                <RotateCcw size={15} />
              </Button>
            )}
          </div>
          <div ref={list} className={styles.list} role="group" aria-label={label}>
            {filtered.map(option => (
              <label key={String(option.value)} className={styles.option}>
                <Checkbox
                  aria-label={option.text}
                  checked={selected.has(String(option.value))}
                  disabled={creating}
                  onCheckedChange={checked => {
                    const remaining = value.filter(item => String(item) !== String(option.value))
                    onChange(checked ? [...remaining, option.value] : remaining)
                  }}
                />
                <span>{option.text}</span>
              </label>
            ))}
            {loading && <p role="status" className={styles.note}>{t('Загрузка вариантов…')}</p>}
            {!loading && !filtered.length && <p className={styles.note}>{t('Нет подходящих вариантов')}</p>}
          </div>
          {canCreate && (
            <Button type="button" className={styles.create} variant="outline" disabled={creating} onClick={create}>
              <Plus size={14} />
              {creating ? t('Добавление…') : t('Создать ключ «{key}»', { key: term })}
            </Button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
