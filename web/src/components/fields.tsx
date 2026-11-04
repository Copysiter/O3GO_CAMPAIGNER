'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Upload } from 'lucide-react'
import { api } from '@/lib/api'
import type { Field } from '@/lib/resources'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Checkbox } from './ui/checkbox'
import { Switch } from './ui/switch'
import { DateTimePicker } from './date-time-picker'
import { Button } from './ui/button'
import { ErrorBox } from './common'
import { useAuth } from './providers'
export type Option = { value: string | number; text: string }
export function useOptions(path?: string) {
  const { t } = useI18n()

  return useQuery<Option[]>({
    queryKey: ['options', path],
    queryFn: async () => {
      const result = await api(`/options/${path}`)
      if (!Array.isArray(result))
        throw new Error(t('Не удалось получить список вариантов'))
      return result
    },
    enabled: !!path,
    staleTime: 60000,
  })
}
export function canUseField(field: Field, user: any) {
  return (
    (!field.admin || user?.is_superuser) &&
    (!field.permission ||
      user?.is_superuser ||
      user?.permissions?.includes(field.permission))
  )
}
export function FieldControl({
  field,
  value,
  onChange,
  editing = false,
}: {
  field: Field
  value: any
  onChange: (v: any) => void
  editing?: boolean
}) {
  const { t, locale } = useI18n()

  const { session } = useAuth()
  const client = useQueryClient()
  const visible = canUseField(field, session?.user)
  const options = useOptions(visible ? field.options : undefined)
  const [search, setSearch] = useState(''),
    [creating, setCreating] = useState(false)
  if (!visible) return null
  if (field.type === 'separator')
    return (
      <div
        role="separator"
        aria-orientation="horizontal"
        className="form-divider md:col-span-2"
        data-separator={field.key}
      />
    )
  const span =
    field.fullWhenNoOwner && !session?.user.is_superuser
      ? 2
      : (field.span ??
        (['textarea', 'multi', 'files'].includes(field.type || '') ? 2 : 1))
  const choices =
    field.choices?.map(([value, text]) => ({ value, text: t(text) })) ||
    options.data ||
    []
  const selected: (string | number)[] = Array.isArray(value) ? value : []
  const available = [
    ...choices,
    ...selected
      .filter((item) => !choices.some((o) => String(o.value) === String(item)))
      .map((item) => ({ value: item, text: String(item) })),
  ]
  const filtered = available.filter((o) =>
    String(o.text).toLowerCase().includes(search.toLowerCase()),
  )
  const id = `field-${field.key}`
  const canCreateKey =
    field.options === 'api_key' &&
    !!search.trim() &&
    !available.some((o) => String(o.value) === search.trim()) &&
    (session?.user.is_superuser ||
      session?.user.permissions?.includes('api_keys.manage'))
  async function addKey() {
    setCreating(true)
    try {
      const result = await api('/api_keys/', {
        method: 'POST',
        body: JSON.stringify({ value: search.trim() }),
      })
      onChange([...selected, result.value])
      setSearch('')
      await client.invalidateQueries({ queryKey: ['options', 'api_key'] })
      toast.success(t('API-ключ добавлен'))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Не удалось добавить API-ключ'),
      )
    } finally {
      setCreating(false)
    }
  }
  if (field.type === 'boolean')
    return (
      <div
        className={`form-field form-field-switch ${span === 2 ? 'md:col-span-2' : ''}`}
      >
        <label htmlFor={id}>{t(field.label)}</label>
        <Switch
          id={id}
          aria-label={t(field.label)}
          checked={value === true}
          onCheckedChange={onChange}
        />
      </div>
    )
  return (
    <div className={`form-field min-w-0 ${span === 2 ? 'md:col-span-2' : ''}`}>
      <label htmlFor={id} className="text-xs font-medium">
        {t(field.label)}
        {field.required && (
          <span aria-hidden="true" className="ml-1 text-primary">
            *
          </span>
        )}
      </label>
      {field.type === 'multi' ? (
        <div className="rounded-sm border bg-background p-2">
          <Input
            id={id}
            aria-label={t('Поиск: {field}', { field: t(field.label) })}
            placeholder={t('Найти или выбрать…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
          <div
            role="group"
            aria-label={t(field.label)}
            className="mt-2 max-h-48 overflow-auto overscroll-contain"
          >
            {filtered.map((o) => (
              <label
                key={String(o.value)}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-2 hover:bg-secondary md:min-h-9"
              >
                <Checkbox
                  className="size-4"
                  checked={selected.map(String).includes(String(o.value))}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked
                        ? [
                            ...selected.filter(
                              (v) => String(v) !== String(o.value),
                            ),
                            o.value,
                          ]
                        : selected.filter((v) => String(v) !== String(o.value)),
                    )
                  }
                />
                <span className="break-all text-xs">{o.text}</span>
              </label>
            ))}
            {options.isPending && field.options && (
              <p role="status" className="p-2 text-xs text-muted-foreground">
                {t('Загрузка вариантов…')}
              </p>
            )}
            {!options.isFetching && !filtered.length && (
              <p className="p-2 text-xs text-muted-foreground">
                {t('Нет подходящих вариантов')}
              </p>
            )}
          </div>
          {canCreateKey && (
            <Button
              type="button"
              variant="outline"
              className="mt-2 w-full"
              disabled={creating}
              onClick={addKey}
            >
              <Plus size={14} />
              {creating
                ? t('Добавление…')
                : t('Создать ключ «{key}»', { key: search.trim() })}
            </Button>
          )}
          <div className="mt-2 flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
            <span>{t('Выбрано: {count}', { count: selected.length })}</span>
            {selected.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange([])}
              >
                {t('Сбросить')}
              </Button>
            )}
          </div>
        </div>
      ) : field.type === 'role' ? (
        <select
          id={id}
          className="native-select w-full"
          value={value === true ? 'admin' : 'user'}
          onChange={(event) => onChange(event.target.value === 'admin')}
        >
          <option value="user">{t('Пользователь')}</option>
          <option value="admin">{t('Администратор')}</option>
        </select>
      ) : field.type === 'option' ? (
        <select
          id={id}
          className="native-select w-full"
          value={value ?? ''}
          required={field.required}
          onChange={(e) =>
            onChange(
              choices.find((o) => String(o.value) === e.target.value)?.value ??
                null,
            )
          }
        >
          <option value="">{t('Не выбрано')}</option>
          {value != null &&
            value !== '' &&
            !choices.some((o) => String(o.value) === String(value)) && (
              <option value={value}>{String(value)}</option>
            )}
          {choices.map((o) => (
            <option key={String(o.value)} value={o.value}>
              {o.text}
            </option>
          ))}
        </select>
      ) : field.type === 'date' ? (
        <DateTimePicker
          id={id}
          value={String(value || '')}
          required={field.required}
          onChange={(next) => onChange(next ? `${next.slice(0, 16)}:00` : null)}
        />
      ) : field.type === 'textarea' ? (
        <Textarea
          id={id}
          rows={3}
          value={value ?? ''}
          required={field.required}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === 'file' || field.type === 'files' ? (
        <>
          <Input
            id={id}
            type="file"
            className="sr-only"
            accept={field.type === 'files' ? '.tar.gz' : '.apk'}
            multiple={field.type === 'files'}
            onChange={(e) => onChange(Array.from(e.target.files || []))}
          />
          <div className="flex min-h-9 flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById(id)?.click()}
            >
              <Upload size={14} />
              {t(field.type === 'files' ? 'Выбрать файлы' : 'Выбрать файл')}
            </Button>
            {(!value || (Array.isArray(value) && !value.length)) && (
              <span className="text-xs text-muted-foreground">
                {t('Файл не выбран')}
              </span>
            )}
          </div>
          {editing && typeof value === 'string' && (
            <p className="break-all text-xs text-muted-foreground">
              {t('Текущий файл: {filename}. Для замены выберите новый.', {
                filename: value,
              })}
            </p>
          )}
          {Array.isArray(value) && value.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {value.map((file: File) => (
                <li className="break-all" key={`${file.name}-${file.size}`}>
                  {file.name} ·{' '}
                  {(file.size / 1024 / 1024).toLocaleString(locale, {
                    maximumFractionDigits: 1,
                  })}{' '}
                  {t('МБ')}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <Input
          id={id}
          type={
            field.type === 'number'
              ? 'number'
              : field.type === 'password'
                ? 'password'
                : field.type === 'color'
                  ? 'color'
                  : field.type === 'url'
                    ? 'url'
                    : 'text'
          }
          value={value ?? ''}
          required={field.required}
          autoComplete={field.type === 'password' ? 'new-password' : undefined}
          min={field.type === 'number' ? (field.min ?? 0) : undefined}
          onChange={(e) =>
            onChange(
              field.type === 'number'
                ? e.target.value === ''
                  ? null
                  : Number(e.target.value)
                : e.target.value,
            )
          }
        />
      )}
      {field.help && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t(field.help)}
        </p>
      )}
      {options.error && (
        <ErrorBox error={options.error} retry={() => options.refetch()} />
      )}
    </div>
  )
}
export function FormFields({
  fields,
  values,
  onChange,
  editing = false,
}: {
  fields: Field[]
  values: Record<string, any>
  onChange: (key: string, value: any) => void
  editing?: boolean
}) {
  return (
    <div className="form-grid grid grid-cols-1 gap-x-2.5 gap-y-[15px] md:grid-cols-2">
      {fields.map((field) => (
        <FieldControl
          key={field.key}
          field={field}
          value={values[field.key]}
          onChange={(v) => onChange(field.key, v)}
          editing={editing}
        />
      ))}
    </div>
  )
}
