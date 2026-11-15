'use client'

import { useRef, useState } from 'react'
import { Plus, X, SlidersHorizontal } from 'lucide-react'
import type { Column } from '@/lib/resources'
import { allowedOperators, operators, unary, type Filter, type Operator } from '@/lib/filters'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Modal, ErrorBox } from './common'
import { useOptions } from './fields'
import { MultiSelect } from './multiselect'
import { useAuth } from './providers'
import { useI18n } from '@/lib/i18n'
import { DateTimePicker } from './date-time-picker'
function FilterValue({
  column,
  filter,
  onChange,
}: {
  column: Column
  filter: Filter
  onChange: (v: Filter) => void
}) {
  const { session } = useAuth()
  const { t } = useI18n()
  const optionsPath =
    column.options === 'user' && !session?.user.is_superuser ? undefined : column.options
  const options = useOptions(optionsPath)
  const choices =
    column.choices?.map(([value, text]) => ({ value, text: t(text) })) || options.data || []
  if (unary.has(filter.operator))
    return (
      <p className="py-3 text-sm text-form-caption">
        {t('Для этого оператора значение не нужно.')}
      </p>
    )
  if (choices.length || optionsPath || column.choices) {
    if (filter.operator === 'in' || filter.operator === 'overlaps')
      return (
        <div className="filter-value-control flex min-w-0 flex-col gap-2">
          <MultiSelect
            label={t('Значение фильтра')}
            searchLabel={t('Поиск значений')}
            options={choices}
            value={Array.isArray(filter.value) ? filter.value.map((value) => value ?? 'null') : []}
            onChange={(value) => onChange({ ...filter, value })}
            loading={Boolean(optionsPath) && options.isPending}
          />
          {options.error && <ErrorBox error={options.error} retry={() => options.refetch()} />}
        </div>
      )
    return (
      <div className="filter-value-control flex min-w-0 flex-col gap-2">
        <select
          className="native-select w-full"
          aria-label={t('Значение фильтра')}
          value={String(filter.value ?? '')}
          onChange={(e) =>
            onChange({
              ...filter,
              value:
                choices.find((o) => String(o.value) === e.target.value)?.value ?? e.target.value,
            })
          }
        >
          <option value="">{t('Выберите…')}</option>
          {choices.map((o) => (
            <option key={o.value} value={o.value}>
              {o.text}
            </option>
          ))}
        </select>
        {options.error && <ErrorBox error={options.error} retry={() => options.refetch()} />}
      </div>
    )
  }
  return (
    <div className="filter-value-control flex min-w-0 flex-col gap-2">
      {column.type === 'date' ? (
        <DateTimePicker
          aria-label={t('Значение фильтра')}
          value={String(filter.value ?? '')
            .replace(' ', 'T')
            .slice(0, 16)}
          onChange={(value) =>
            onChange({ ...filter, value: value ? `${value.replace('T', ' ')}:00` : '' })
          }
        />
      ) : (
        <Input
          aria-label={t('Значение фильтра')}
          type={column.type === 'number' ? 'number' : 'text'}
          value={String(filter.value ?? '')}
          onChange={(e) =>
            onChange({
              ...filter,
              value:
                column.type === 'number'
                  ? e.target.value === ''
                    ? ''
                    : Number(e.target.value)
                  : e.target.value,
            })
          }
        />
      )}
      {column.type === 'date' && (
        <p className="text-xs text-form-caption">{t('Дата и время в UTC.')}</p>
      )}
    </div>
  )
}
type DraftRow = { id: number; filter: Filter }
const newFilter = (column: Column): Filter => {
  const operator = allowedOperators(column.type || 'text')[0]
  return { field: column.key, operator, value: operator === 'overlaps' ? [] : '' }
}
const cloneFilter = (filter: Filter): Filter => ({
  ...filter,
  value: Array.isArray(filter.value) ? [...filter.value] : filter.value,
})
function validFilter(filter: Filter, column?: Column) {
  if (!column || !allowedOperators(column.type || 'text').includes(filter.operator as Operator))
    return false
  if (unary.has(filter.operator)) return true
  if (Array.isArray(filter.value)) return filter.value.length > 0
  if (filter.value === undefined || filter.value === null) return false
  if (filter.value === '' && (column.type || 'text') !== 'text') return false
  return column.type !== 'number' || (filter.value !== '' && Number.isFinite(Number(filter.value)))
}
export function FilterDialog({
  columns,
  filters,
  initial,
  onApply,
  onClose,
}: {
  columns: Column[]
  filters: Filter[]
  initial?: Filter
  onApply: (filters: Filter[]) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const available = columns.filter((column) => column.filter !== false)
  const sequence = useRef(0)
  const [draft, setDraft] = useState<DraftRow[]>(() => {
    const prepared = filters.map(cloneFilter)
    if (initial && !prepared.some((filter) => filter.field === initial.field))
      prepared.push(cloneFilter(initial))
    if (!prepared.length && available[0]) prepared.push(newFilter(available[0]))
    return prepared.map((filter) => ({ id: sequence.current++, filter }))
  })
  const valid = draft.every(({ filter }) =>
    validFilter(
      filter,
      available.find((column) => column.key === filter.field),
    ),
  )
  const update = (id: number, filter: Filter) =>
    setDraft((rows) => rows.map((row) => (row.id === id ? { ...row, filter } : row)))
  const add = () => {
    const column =
      available.find((candidate) => !draft.some(({ filter }) => filter.field === candidate.key)) ||
      available[0]
    if (column) {
      const row = { id: sequence.current++, filter: newFilter(column) }
      setDraft((rows) => [...rows, row])
    }
  }
  return (
    <Modal
      open
      autoFocus={false}
      className="form-surface filter-dialog"
      onOpenChange={(open) => !open && onClose()}
      title={t('Фильтры')}
      description={t(
        'Условия по разным полям применяются вместе. Для статуса, тегов и API-ключей достаточно совпадения с одним из выбранных значений поля.',
      )}
      footer={
        <div className="filter-footer">
          <Button
            variant="outline"
            size="icon"
            className="filter-add-row"
            aria-label={t('Добавить условие')}
            title={t('Добавить условие')}
            disabled={!available.length}
            onClick={add}
          >
            <Plus size={16} />
          </Button>
          <div className="filter-footer-actions">
            <Button variant="outline" onClick={onClose}>
              {t('Отмена')}
            </Button>
            <Button
              disabled={!valid}
              onClick={() => onApply(draft.map(({ filter }) => cloneFilter(filter)))}
            >
              {t('Применить')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="filter-dialog-rows">
        {!draft.length && (
          <p className="filter-empty text-sm text-form-caption">{t('Условия не добавлены')}</p>
        )}
        {draft.map(({ id, filter }, index) => {
          const column = available.find((candidate) => candidate.key === filter.field)
          if (!column) return null
          return (
            <fieldset
              key={id}
              className="filter-row"
              aria-label={t('Условие {count}', { count: index + 1 })}
              data-active={initial?.field === filter.field || undefined}
            >
              <label className="filter-row-property grid min-w-0 gap-1.5 text-xs">
                <span className="text-form-caption">{t('Колонка')}</span>
                <select
                  aria-label={t('Колонка')}
                  className="native-select w-full"
                  value={filter.field}
                  onChange={(event) => {
                    const next = available.find((candidate) => candidate.key === event.target.value)
                    if (next) update(id, newFilter(next))
                  }}
                >
                  {available.map((candidate) => (
                    <option key={candidate.key} value={candidate.key}>
                      {t(candidate.label)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-row-operator grid min-w-0 gap-1.5 text-xs">
                <span className="text-form-caption">{t('Оператор')}</span>
                <select
                  aria-label={t('Оператор')}
                  className="native-select w-full"
                  value={filter.operator}
                  onChange={(event) =>
                    update(id, {
                      ...filter,
                      operator: event.target.value,
                      value: ['overlaps', 'in'].includes(event.target.value) ? [] : '',
                    })
                  }
                >
                  {allowedOperators(column.type || 'text').map((operator) => (
                    <option key={operator} value={operator}>
                      {t(operators[operator])}
                    </option>
                  ))}
                </select>
              </label>
              <div className="filter-row-value grid min-w-0 gap-1.5">
                <span className="text-xs text-form-caption">{t('Значение')}</span>
                <FilterValue
                  key={filter.field + filter.operator}
                  column={column}
                  filter={filter}
                  onChange={(value) => update(id, value)}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="filter-row-remove"
                aria-label={t('Удалить условие {count}', { count: index + 1 })}
                title={t('Удалить условие {count}', { count: index + 1 })}
                onClick={() => setDraft((rows) => rows.filter((row) => row.id !== id))}
              >
                <X size={16} />
              </Button>
            </fieldset>
          )
        })}
      </div>
    </Modal>
  )
}
export function FilterBar({
  filters,
  columns,
  onChange,
  editor,
  setEditor,
}: {
  filters: Filter[]
  columns: Column[]
  onChange: (filters: Filter[]) => void
  editor: { filter?: Filter; index?: number } | null
  setEditor: (value: { filter?: Filter; index?: number } | null) => void
}) {
  const { t } = useI18n()
  return (
    <>
      <div className="filter-bar">
        <Button
          variant="outline"
          className="filter-add-button"
          aria-label={t('Фильтры')}
          title={t('Фильтры')}
          disabled={!columns.some((column) => column.filter !== false)}
          onClick={() => setEditor({})}
        >
          <SlidersHorizontal size={16} />
          <span className="hidden min-[360px]:inline">{t('Фильтры')}</span>
          {filters.length > 0 && (
            <span className="filter-count rounded-sm bg-primary/15 px-1.5 text-primary">
              {filters.length}
            </span>
          )}
        </Button>
      </div>
      {editor && (
        <FilterDialog
          columns={columns}
          filters={filters}
          initial={editor.filter}
          onClose={() => setEditor(null)}
          onApply={(next) => {
            onChange(next)
            setEditor(null)
          }}
        />
      )}
    </>
  )
}
