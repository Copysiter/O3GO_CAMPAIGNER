'use client'

import { useId, useState, type FormEvent } from 'react'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@tanstack/react-query'
import { Copy, Save } from 'lucide-react'
import { toast } from 'sonner'
import { api, setSession, type Row } from '@/lib/api'
import { useAuth } from './providers'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ErrorBox, Loading, Modal } from './common'
export function ProfileModal({open,onOpenChange}:{open:boolean;onOpenChange:(open:boolean)=>void}) {
  const {t}=useI18n()
  const formId=useId()
  const [pending,setPending]=useState(false)
  return <Modal open={open} onOpenChange={onOpenChange} title={t('Мой профиль')} footer={<>
    <Button variant="outline" onClick={()=>onOpenChange(false)}>{t('Закрыть')}</Button>
    <Button form={formId} type="submit" disabled={pending}><Save size={16}/>{pending?t('Сохранение…'):t('Сохранить')}</Button>
  </>}>
    {open && <Profile embedded formId={formId} onPendingChange={setPending} />}
  </Modal>
}
export function Profile({embedded=false,formId='profile-editor',onPendingChange}:{embedded?:boolean;formId?:string;onPendingChange?:(pending:boolean)=>void}={}) {
  const query = useQuery<Row>({
    queryKey: ['profile'],
    queryFn: () => api('/users/me'),
  })
  if (query.isPending) return <Loading />
  if (query.error)
    return (
      <div className="p-4 md:p-6">
        <ErrorBox error={query.error} retry={() => query.refetch()} />
      </div>
    )
  return <ProfileForm key={query.data.id} user={query.data} embedded={embedded} formId={formId} onPendingChange={onPendingChange} />
}
function ProfileForm({ user,embedded,formId,onPendingChange }: { user: Row;embedded:boolean;formId:string;onPendingChange?:(pending:boolean)=>void }) {
  const { t } = useI18n()

  const { session } = useAuth()
  const [name, setName] = useState(user.name || ''),
    [login, setLogin] = useState(user.login || ''),
    [password, setPassword] = useState('')
  const [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(null)
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!login.trim() || !session) return
    setPending(true)
    onPendingChange?.(true)
    setError(null)
    try {
      const result = await api('/users/me', {
        method: 'PUT',
        body: JSON.stringify({
          name,
          login: login.trim(),
          ...(password ? { password } : {}),
        }),
      })
      setSession({ ...session, user: { ...session.user, ...result } })
      setPassword('')
      toast.success(t('Профиль обновлён'))
    } catch (err) {
      setError(err)
    } finally {
      setPending(false)
      onPendingChange?.(false)
    }
  }
  return (
    <div className={embedded?'profile-embedded':'resource-page'}>
      {!embedded && <header className="page-toolbar profile-actions">
        <Button type="submit" form={formId} disabled={pending}>
          <Save size={16} />
          {pending ? t('Сохранение…') : t('Сохранить')}
        </Button>
      </header>}
      <div className={embedded?'profile-form-content':'resource-body scroll-content'}>
        <div className="max-w-3xl">
          <form
            id={formId}
            className="panel space-y-4 p-4"
            onSubmit={save}
          >
            {error != null && <ErrorBox error={error} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="form-field">
                <label htmlFor="profile-name">{t('Имя')}</label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  disabled={pending}
                />
              </div>
              <div className="form-field">
                <label htmlFor="profile-login">{t('Логин')}</label>
                <Input
                  id="profile-login"
                  required
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                  autoComplete="username"
                  disabled={pending}
                />
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="profile-password">{t('Новый пароль')}</label>
              <Input
                id="profile-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                disabled={pending}
              />
              <span className="block font-normal text-muted-foreground">
                {t('Оставьте пустым, чтобы сохранить текущий пароль.')}
              </span>
            </div>
          </form>
          <section className="panel mt-4 space-y-4 p-4 md:p-5">
            <div>
              <h2 className="text-sm font-semibold">
                {t('Доступ к интеграциям')}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('Внешний API-ключ выдаётся администратором.')}
              </p>
            </div>
            {user.ext_api_key ? (
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  aria-label={t('Внешний API-ключ')}
                  type="password"
                  value={user.ext_api_key}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t('Скопировать внешний API-ключ')}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(user.ext_api_key)
                      toast.success(t('Ключ скопирован'))
                    } catch {
                      toast.error(t('Браузер не разрешил копирование'))
                    }
                  }}
                >
                  <Copy size={16} />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('Внешний API-ключ ещё не назначен')}
              </p>
            )}
            <dl className="grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t('Роль')}</dt>
                <dd className="mt-1">
                  {user.is_superuser ? t('Администратор') : t('Пользователь')}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('Идентификатор')}</dt>
                <dd className="mt-1 font-mono">#{user.id}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}
