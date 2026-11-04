'use client'

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
} from 'react'
import { Dialog, Popover } from 'radix-ui'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

export type DateTimePickerProps = Omit<
  ComponentProps<'input'>,
  'type' | 'value' | 'onChange'
> & {
  value: string
  onChange: (value: string) => void
}
const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const fromKey = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// The text input retains the existing datetime-local contract. The separate
// calendar provides the themed picker without delegating its UI to the OS.
export function DateTimePicker({
  value,
  onChange,
  id,
  className,
  disabled,
  required,
  min,
  max,
  ...props
}: DateTimePickerProps) {
  const { t, locale } = useI18n()
  const generated = useId()
  const inputId = id || `datetime-${generated}`
  const contentId = `datetime-content-${generated}`
  const trigger = useRef<HTMLButtonElement>(null)
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const sync = () => setMobile(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  const normalized = String(value || '')
    .replace(' ', 'T')
    .replace(/Z$/, '')
    .slice(0, 16)
  const today = new Date().toISOString().slice(0, 10)
  const selected = /^\d{4}-\d{2}-\d{2}/.test(normalized)
    ? normalized.slice(0, 10)
    : ''
  const hours = normalized.slice(11, 13) || '00'
  const minutes = normalized.slice(14, 16) || '00'
  const initial = fromKey(selected || today)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(
    () => new Date(initial.getFullYear(), initial.getMonth(), 1),
  )
  const [focusDay, setFocusDay] = useState(selected || today)
  const calendar = useRef<HTMLDivElement>(null)
  const focusRequested = useRef(false)
  const minimum = min ? String(min).slice(0, 10) : ''
  const maximum = max ? String(max).slice(0, 10) : ''
  const inBounds = (day: string) =>
    (!minimum || day >= minimum) && (!maximum || day <= maximum)
  const weekStart = new Date(
    month.getFullYear(),
    month.getMonth(),
    1 - ((month.getDay() + 6) % 7),
  )
  const days = Array.from(
    { length: 42 },
    (_, index) =>
      new Date(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        weekStart.getDate() + index,
      ),
  )
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const fullDate = new Intl.DateTimeFormat(locale, { dateStyle: 'full' })
  const setOpened = (next: boolean) => {
    if (next) {
      const current = fromKey(selected || today)
      setMonth(new Date(current.getFullYear(), current.getMonth(), 1))
      setFocusDay(selected || today)
    }
    setOpen(next)
  }
  useEffect(() => {
    if (!open || !focusRequested.current) return
    focusRequested.current = false
    calendar.current
      ?.querySelector<HTMLButtonElement>(`[data-date="${focusDay}"]`)
      ?.focus({ preventScroll: true })
  }, [open, month, focusDay])
  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])
  const selectDate = (day: string) => {
    if (inBounds(day)) onChange(`${day}T${hours}:${minutes}`)
  }
  const moveMonth = (direction: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + direction, 1)
    setMonth(next)
    setFocusDay(dateKey(next))
  }
  const dayKeys = (event: KeyboardEvent<HTMLButtonElement>, day: Date) => {
    const next = new Date(day)
    const weekday = (next.getDay() + 6) % 7
    if (event.key === 'ArrowLeft') next.setDate(next.getDate() - 1)
    else if (event.key === 'ArrowRight') next.setDate(next.getDate() + 1)
    else if (event.key === 'ArrowUp') next.setDate(next.getDate() - 7)
    else if (event.key === 'ArrowDown') next.setDate(next.getDate() + 7)
    else if (event.key === 'Home') next.setDate(next.getDate() - weekday)
    else if (event.key === 'End') next.setDate(next.getDate() + 6 - weekday)
    else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const last = new Date(
        next.getFullYear(),
        next.getMonth() + (event.key === 'PageUp' ? 0 : 2),
        0,
      ).getDate()
      next.setMonth(
        next.getMonth() + (event.key === 'PageUp' ? -1 : 1),
        Math.min(next.getDate(), last),
      )
    } else return
    event.preventDefault()
    const key = dateKey(next)
    if (!inBounds(key)) return
    focusRequested.current = true
    setMonth(new Date(next.getFullYear(), next.getMonth(), 1))
    setFocusDay(key)
  }
  const focusCalendar = (event: Event) => {
    event.preventDefault()
    const day =
      calendar.current?.querySelector<HTMLButtonElement>(
        `[data-date="${focusDay}"]:not(:disabled)`,
      ) ||
      calendar.current?.querySelector<HTMLButtonElement>(
        '.datetime-day:not(:disabled)',
      )
    day?.focus({ preventScroll: true })
  }
  const restoreTriggerFocus = (event: Event) => {
    event.preventDefault()
    trigger.current?.focus({ preventScroll: true })
  }
  const pickerContent = (
    <>
      <div className="datetime-heading">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('Предыдущий месяц')}
          onClick={() => moveMonth(-1)}
        >
          <ChevronLeft size={16} />
        </Button>
        <span className="text-sm font-medium" aria-live="polite">
          {new Intl.DateTimeFormat(locale, {
            month: 'long',
            year: 'numeric',
          }).format(month)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('Следующий месяц')}
          onClick={() => moveMonth(1)}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
      <div
        ref={calendar}
        className="datetime-calendar"
        role="grid"
        aria-label={t('Календарь')}
      >
        <div className="datetime-week" role="row">
          {days.slice(0, 7).map((day) => (
            <div
              key={dateKey(day)}
              role="columnheader"
              className="datetime-weekday"
            >
              {weekday.format(day)}
            </div>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, row) => (
          <div className="datetime-week" role="row" key={row}>
            {days.slice(row * 7, row * 7 + 7).map((day) => {
              const key = dateKey(day)
              return (
                <div
                  role="gridcell"
                  aria-selected={selected === key}
                  key={key}
                >
                  <button
                    type="button"
                    className="datetime-day"
                    data-date={key}
                    data-outside={day.getMonth() !== month.getMonth()}
                    data-selected={selected === key}
                    aria-label={fullDate.format(day)}
                    aria-current={key === today ? 'date' : undefined}
                    tabIndex={key === focusDay ? 0 : -1}
                    disabled={!inBounds(key)}
                    onKeyDown={(event) => dayKeys(event, day)}
                    onClick={() => {
                      setFocusDay(key)
                      selectDate(key)
                    }}
                  >
                    {day.getDate()}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div className="datetime-time">
        <label className="form-field">
          <span>{t('Часы')}</span>
          <select
            aria-label={t('Часы')}
            className="native-select"
            value={hours}
            onChange={(event) =>
              onChange(
                `${selected || today}T${event.target.value}:${minutes}`,
              )
            }
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={pad(i)}>
                {pad(i)}
              </option>
            ))}
          </select>
        </label>
        <span className="datetime-time-divider" aria-hidden="true">
          :
        </span>
        <label className="form-field">
          <span>{t('Минуты')}</span>
          <select
            aria-label={t('Минуты')}
            className="native-select"
            value={minutes}
            onChange={(event) =>
              onChange(
                `${selected || today}T${hours}:${event.target.value}`,
              )
            }
          >
            {Array.from({ length: 60 }, (_, i) => (
              <option key={i} value={pad(i)}>
                {pad(i)}
              </option>
            ))}
          </select>
        </label>
        <span className="datetime-zone">UTC</span>
      </div>
      <div className="datetime-footer">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange('')}
        >
          {t('Очистить')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(new Date().toISOString().slice(0, 16))}
        >
          {t('Сейчас')}
        </Button>
        <Button type="button" size="sm" onClick={() => setOpened(false)}>
          {t('Готово')}
        </Button>
      </div>
    </>
  )
  const field = (
    <div
      className="date-time-picker relative min-w-0"
      style={{ minWidth: 0, maxWidth: '100%' }}
    >
      <Input
        {...props}
        id={inputId}
        className={cn('datetime-input', className)}
        style={{
          ...props.style,
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          height: 36,
          appearance: 'none',
        }}
        type="datetime-local"
        step={60}
        value={normalized}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required={required}
        min={min}
        max={max}
        onPointerDown={(event) => {
          props.onPointerDown?.(event)
          if (
            !event.defaultPrevented &&
            event.pointerType === 'touch' &&
            !disabled
          ) {
            event.preventDefault()
            setOpened(true)
          }
        }}
        onKeyDown={(event) => {
          props.onKeyDown?.(event)
          if (
            !event.defaultPrevented &&
            event.key === 'ArrowDown' &&
            event.altKey
          ) {
            event.preventDefault()
            setOpened(true)
          }
        }}
      />
      <button
        ref={trigger}
        type="button"
        className="datetime-trigger"
        disabled={disabled}
        aria-label={t('Открыть календарь')}
        title={t('Открыть календарь')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? contentId : undefined}
        onClick={() => setOpened(!open)}
      >
        <CalendarDays size={16} />
      </button>
    </div>
  )
  if (mobile) {
    return (
      <Dialog.Root open={open} onOpenChange={setOpened}>
        {field}
        <Dialog.Portal>
          <Dialog.Overlay className="datetime-mobile-overlay" />
          <Dialog.Content
            id={contentId}
            className="datetime-popover datetime-mobile-dialog"
            aria-describedby={undefined}
            onOpenAutoFocus={focusCalendar}
            onCloseAutoFocus={restoreTriggerFocus}
          >
            <Dialog.Title className="sr-only">
              {t('Выбор даты и времени')}
            </Dialog.Title>
            {pickerContent}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpened}>
      <Popover.Anchor asChild>{field}</Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          id={contentId}
          className="datetime-popover"
          align="end"
          sideOffset={6}
          collisionPadding={8}
          aria-label={t('Выбор даты и времени')}
          onOpenAutoFocus={focusCalendar}
          onCloseAutoFocus={restoreTriggerFocus}
        >
          {pickerContent}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
