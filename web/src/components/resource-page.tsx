'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Activity, Layers, Pause, ShieldCheck } from 'lucide-react'
import { api, downloadReport, type Row, type PageData } from '@/lib/api'
import {
  resources,
  hasPermission,
  canReadResource,
  canManageResource,
  type Resource,
} from '@/lib/resources'
import { serializeQuery } from '@/lib/filters'
import { DataTable, type Action } from './data-table'
import { Button } from './ui/button'
import { Modal, ErrorBox } from './common'
import { Editor } from './editor'
import { CampaignForm } from './campaign-form'
import { useAuth } from './providers'
export const campaignActions: Action[] = [
  { key: 'edit', label: 'Настройки кампании' },
  { key: 'start', label: 'Запустить' },
  { key: 'pause', label: 'Поставить на паузу' },
  { key: 'stop', label: 'Остановить' },
  { key: 'retry', label: 'Повторить недоставленные' },
  { key: 'check_dst', label: 'Проверить номера' },
  { key: 'export', label: 'Скачать Excel' },
  { key: 'clear', label: 'Очистить сообщения', danger: true },
  { key: 'delete', label: 'Удалить кампанию', danger: true },
]
export function getResourceActions(
  resource: Resource,
  user: Parameters<typeof canManageResource>[1],
): Action[] {
  if (resource.key === 'campaigns')
    return campaignActions.filter((action) =>
      ['start', 'pause', 'stop'].includes(action.key)
        ? hasPermission(user, 'campaign.start_stop')
        : action.key === 'export'
          ? canReadResource(resource, user)
          : canManageResource(resource, user),
    )
  if (!canManageResource(resource, user)) return []
  return [
    ...(resource.edit ? [{ key: 'edit', label: 'Редактировать' }] : []),
    { key: 'delete', label: 'Удалить', danger: true },
  ]
}
export function useResourceActions(resource: Resource) {
  const { t } = useI18n()

  const { session } = useAuth()
  const client = useQueryClient()
  const [edit, setEdit] = useState<Row | undefined | null>(null),
    [confirm, setConfirm] = useState<{ action: string; rows: Row[] } | null>(
      null,
    ),
    [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(null)
  const onAction = (action: string, rows: Row[]) => {
    const allowed = resource.key.startsWith('messages-')
      ? hasPermission(session?.user, 'campaign.manage')
      : getResourceActions(resource, session?.user).some(
          (item) => item.key === action,
        )
    if (!allowed || !rows.length) {
      toast.error(t('Недостаточно прав для этого действия'))
      return
    }
    if (action === 'edit') {
      setEdit(rows[0])
      return
    }
    setError(null)
    setConfirm({ action, rows })
  }
  const perform = async () => {
    if (!confirm) return
    setPending(true)
    setError(null)
    const successes: number[] = [],
      failures: string[] = []
    for (const row of confirm.rows) {
      try {
        if (confirm.action === 'export') await downloadReport(row.id)
        else if (resource.key === 'campaigns') {
          const path =
            confirm.action === 'delete'
              ? `/campaigns/${row.id}`
              : confirm.action === 'clear'
                ? `/campaigns/${row.id}/campaign_dst`
                : `/campaigns/${row.id}/${confirm.action}`
          await api(path, {
            method: ['delete', 'clear'].includes(confirm.action)
              ? 'DELETE'
              : 'POST',
          })
        } else if (resource.key.startsWith('messages-'))
          await api(resource.endpoint, {
            method: 'DELETE',
            body: JSON.stringify({ ids: [row.id] }),
          })
        else await api(resource.endpoint + row.id, { method: 'DELETE' })
        successes.push(row.id)
      } catch (err) {
        failures.push(
          `#${row.id}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }
    await client.invalidateQueries({ queryKey: ['rows'] })
    await client.invalidateQueries({ queryKey: ['campaign'] })
    await client.invalidateQueries({ queryKey: ['campaign-count'] })
    if (failures.length) {
      setError(
        new Error(
          t('Выполнено: {count}. Ошибки: {errors}', {
            count: successes.length,
            errors: failures.join('; '),
          }),
        ),
      )
      setConfirm({
        ...confirm,
        rows: confirm.rows.filter((r) => !successes.includes(r.id)),
      })
    } else {
      toast.success(
        confirm.action === 'export'
          ? t('Файл скачан')
          : t('Действие выполнено'),
      )
      setConfirm(null)
    }
    setPending(false)
  }
  const title =
    (resource.key === 'campaigns'
      ? campaignActions.find((a) => a.key === confirm?.action)?.label
      : undefined) ||
    (confirm?.action === 'delete'
      ? t('Удалить выбранные записи')
      : t('Подтвердить действие'))
  const dialogs = (
    <>
      {edit !== null &&
        (resource.key === 'campaigns' ? (
          <CampaignForm row={edit} onClose={() => setEdit(null)} />
        ) : (
          <Editor
            resource={resource}
            row={edit}
            onClose={() => setEdit(null)}
          />
        ))}
      <Modal
        open={!!confirm}
        onOpenChange={(v) => !v && !pending && setConfirm(null)}
        title={t(title)}
        description={t('Выбрано записей: {count}', {
          count: confirm?.rows.length || 0,
        })}
        footer={
          <>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setConfirm(null)}
            >
              {t('Отмена')}
            </Button>
            <Button
              variant={
                ['delete', 'clear'].includes(confirm?.action || '')
                  ? 'destructive'
                  : 'default'
              }
              disabled={pending}
              onClick={perform}
            >
              {pending ? t('Выполняется…') : t('Подтвердить')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error != null && <ErrorBox error={error} />}
          <p className="text-sm">
            {confirm?.action === 'start'
              ? t(
                  'Это действие разрешит реальную отправку сообщений получателям.',
                )
              : ['delete', 'clear'].includes(confirm?.action || '')
                ? t('Данные будут удалены. Это действие нельзя отменить.')
                : confirm?.action === 'retry'
                  ? t(
                      'Будет создана новая кампания из недоставленных сообщений.',
                    )
                  : t('Проверьте выбранные записи перед продолжением.')}
          </p>
          <ul className="max-h-48 overflow-auto space-y-2 rounded-sm border bg-background p-3 text-sm">
            {confirm?.rows.map((row) => (
              <li key={row.id} className="break-words">
                #{row.id} ·{' '}
                {row.name ||
                  row.file_name ||
                  row.dst_addr ||
                  row.value ||
                  row.device_name ||
                  row.login ||
                  t('Запись')}
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </>
  )
  return {
    onAction,
    dialogs,
    create: () => {
      if (resource.create && canManageResource(resource, session?.user))
        setEdit(undefined)
      else toast.error(t('Создание недоступно для вашей учётной записи'))
    },
  }
}
function CampaignOverview() {
  const { t, locale } = useI18n()

  const counts = useQuery({
    queryKey: ['campaign-count'],
    queryFn: () =>
      Promise.all(
        [undefined, 1, 2].map((status) =>
          api<PageData>(
            '/campaigns/?' +
              serializeQuery(
                status === undefined
                  ? []
                  : [{ field: 'status', operator: 'eq', value: status }],
                [],
                0,
                1,
                true,
              ),
          ),
        ),
      ),
    staleTime: 60000,
    refetchInterval: 30000,
  })
  return (
    <div
      className="resource-stats campaign-overview grid shrink-0 grid-cols-3 gap-2"
      role="group"
      aria-label={t('Статистика всех кампаний')}
      title={t('Без учёта фильтров таблицы')}
    >
      {[
        { label: 'Всего кампаний', icon: Layers },
        { label: 'В работе', icon: Activity },
        { label: 'Остановлены', icon: Pause },
      ].map(({ label, icon: Icon }, i) => (
        <div key={label} className="resource-stat">
          <div className="resource-stat-label" title={t(label)}>
            <Icon size={16} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{t(label)}</span>
          </div>
          <div className="resource-stat-value">
            {counts.data?.[i].total.toLocaleString(locale) ?? '—'}
          </div>
        </div>
      ))}
    </div>
  )
}
export function ResourcePage({ resourceKey }: { resourceKey: string }) {
  const { t } = useI18n()

  const { session } = useAuth()
  const router = useRouter()
  const resource = resources[resourceKey]
  if (!resource)
    return (
      <div className="p-6">
        <h1 className="mb-3 text-xl">{t('Раздел не подключён')}</h1>
        <p className="text-muted-foreground">
          {t(
            'В текущем API отсутствует рабочий маршрут этого раздела. Бэкенд не изменён.',
          )}
        </p>
        <Button className="mt-4" onClick={() => router.push('/campaigns')}>
          {t('К кампаниям')}
        </Button>
      </div>
    )
  if (!canReadResource(resource, session?.user))
    return (
      <div className="p-8">
        <ShieldCheck className="mb-3" />
        <h1 className="text-xl">
          {resource.admin
            ? t('Доступ только администратору')
            : t('Нет доступа к разделу')}
        </h1>
      </div>
    )
  return <ResourceContent key={resourceKey} resource={resource} />
}
function ResourceContent({ resource }: { resource: Resource }) {
  const { t } = useI18n()

  const { onAction, dialogs, create } = useResourceActions(resource)
  const router = useRouter()
  const { session } = useAuth()
  const actions = getResourceActions(resource, session?.user)
  const bulk =
    resource.key === 'campaigns'
      ? [
          { key: 'start', label: t('Запустить') },
          { key: 'pause', label: t('Пауза') },
          { key: 'stop', label: t('Остановить') },
          { key: 'delete', label: t('Удалить'), danger: true },
        ]
      : [{ key: 'delete', label: t('Удалить'), danger: true }]
  return (
    <div className="resource-page">
      <div className="resource-body">
        {resource.key === 'campaigns' && <CampaignOverview />}
        {resource.notice && (
          <p className="shrink-0 border-l-2 border-primary bg-secondary/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {t(resource.notice)}
          </p>
        )}
        <DataTable
          resource={resource}
          onAction={onAction}
          createAction={
            resource.create && canManageResource(resource, session?.user)
              ? {
                  label:
                    resource.key === 'campaigns'
                      ? 'Новая кампания'
                      : 'Добавить',
                  onClick: create,
                }
              : undefined
          }
          actions={actions}
          bulkActions={bulk.filter((action) =>
            actions.some((allowed) => allowed.key === action.key),
          )}
          onOpen={
            resource.key === 'campaigns'
              ? (row) => router.push(`/campaigns/${row.id}`)
              : undefined
          }
        />
      </div>
      {dialogs}
    </div>
  )
}
