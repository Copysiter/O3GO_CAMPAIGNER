'use client'
import { useRef, type ReactNode, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertCircle, LoaderCircle } from 'lucide-react'
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  autoFocus = true,
  size = 'default',
  className,
  bodyClassName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  autoFocus?: boolean
  size?: 'default' | 'compact'
  className?: string
  bodyClassName?: string
}) {
  const { t } = useI18n()
  const content = useRef<HTMLDivElement>(null)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={content}
        tabIndex={-1}
        className={['modal-content', className].filter(Boolean).join(' ')}
        data-size={size}
        onOpenAutoFocus={(event) => {
          if (!autoFocus) {
            event.preventDefault()
            content.current?.focus({ preventScroll: true })
          }
        }}
      >
        <div className="modal-head">
          <DialogTitle className="text-xl leading-snug">{title}</DialogTitle>
          <DialogDescription className="mt-2 text-sm">
            {description || t('Изменения применяются только после подтверждения.')}
          </DialogDescription>
        </div>
        <div className={['modal-body', bodyClassName].filter(Boolean).join(' ')}>{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </DialogContent>
    </Dialog>
  )
}
export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  const { t } = useI18n()
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-sm border border-destructive/40 bg-destructive/10 p-4 text-sm"
    >
      <AlertCircle size={20} />
      <span className="min-w-0 flex-1 break-words">
        {t(error instanceof Error ? error.message : String(error))}
      </span>
      {retry && (
        <Button variant="outline" onClick={retry}>
          {t('Повторить')}
        </Button>
      )}
    </div>
  )
}
export function Loading() {
  const { t } = useI18n()
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 p-12 text-muted-foreground"
    >
      <LoaderCircle className="animate-spin" size={20} />
      {t('Загрузка...')}
    </div>
  )
}
export function StatusBadge({
  children,
  tone = 'info',
}: {
  children: ReactNode
  tone?: 'info' | 'success' | 'warning' | 'error'
}) {
  return (
    <span
      className="status-badge"
      data-tone={tone}
      title={typeof children === 'string' ? children : undefined}
      style={{ '--tone': `var(--${tone})` } as CSSProperties}
    >
      <span className="min-w-0 truncate">{children}</span>
    </span>
  )
}
export function Value({
  value,
  type,
  choices,
  field,
}: {
  value: any
  type?: string
  choices?: [string | number, string][]
  field?: string
}) {
  const { t, locale } = useI18n()
  if (value === null || value === undefined || value === '')
    return <span className="text-muted-foreground">—</span>
  if (field === 'id' || field?.endsWith('_id'))
    return <span className="tabular-nums identifier-value">{String(value)}</span>
  if (field === 'score') {
    const score = Number(value)
    return (
      <StatusBadge
        tone={score < 0 ? 'error' : score < 0.4 ? 'success' : score < 0.7 ? 'warning' : 'error'}
      >
        {score < 0 ? t('Ошибка') : score.toFixed(2)}
      </StatusBadge>
    )
  }
  if (type === 'boolean')
    return <StatusBadge tone={value ? 'success' : 'warning'}>{t(value ? 'Да' : 'Нет')}</StatusBadge>
  if (choices) {
    const label = choices.find(([v]) => String(v) === String(value))?.[1] ?? String(value)
    const error = /ошиб|блок/i.test(label)
    const success = /доставлено|в работе|актив|доступ/i.test(label)
    return (
      <StatusBadge
        tone={
          error ? 'error' : /не достав|пауз|останов/i.test(label) ? 'warning' : success ? 'success' : 'info'
        }
      >
        {t(label)}
      </StatusBadge>
    )
  }
  if (type === 'date') {
    const date = new Date(
      String(value).endsWith('Z') || /[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z',
    )
    return (
      <span className="whitespace-nowrap tabular-nums text-xs">
        {Number.isNaN(+date)
          ? String(value)
          : date.toLocaleString(locale, {
              timeZone: 'UTC',
              dateStyle: 'short',
              timeStyle: 'short',
            })}
      </span>
    )
  }
  if (Array.isArray(value))
    return (
      <div
        className={`value-chips flex flex-wrap gap-1 ${field === 'api_keys' ? 'value-chips-api-keys' : ''}`}
      >
        {value.length ? (
          value.map((v, i) => (
            <span
              key={i}
              className={`value-chip rounded-sm border px-2 py-0.5 text-xs break-all ${field === 'api_keys' ? 'value-chip-api-key' : 'bg-secondary/60'}`}
              style={
                v && typeof v === 'object'
                  ? {
                      backgroundColor: /^#[0-9a-f]{3,8}$/i.test(v.color_bg || '')
                        ? /^#(?:fff|ffff|ffffff|ffffffff)$/i.test(v.color_bg)
                          ? 'var(--card)'
                          : v.color_bg
                        : undefined,
                      color: /^#[0-9a-f]{3,8}$/i.test(v.color_txt || '')
                        ? /^#(?:fff|ffff|ffffff|ffffffff)$/i.test(v.color_txt)
                          ? 'var(--surface-text)'
                          : v.color_txt
                        : undefined,
                    }
                  : undefined
              }
            >
              {v && typeof v === 'object'
                ? (v.name ?? v.text ?? JSON.stringify(v))
                : String(v ?? '—')}
            </span>
          ))
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
    )
  if (typeof value === 'object')
    return <span className="break-words">{value.name ?? value.login ?? JSON.stringify(value)}</span>
  if (type === 'number')
    return (
      <span className="tabular-nums">
        {Number.isFinite(Number(value)) ? Number(value).toLocaleString(locale) : String(value)}
      </span>
    )
  return (
    <span
      className={
        field?.includes('text') || field === 'msg_template'
          ? 'line-clamp-3 whitespace-pre-wrap break-words'
          : 'break-words'
      }
    >
      {String(value)}
    </span>
  )
}
