'use client'

import { useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, uploadFile, type Row } from '@/lib/api'
import { canManageResource, type Resource } from '@/lib/resources'
import { useAuth } from './providers'
import { FormFields, canUseField } from './fields'
import { Modal, ErrorBox } from './common'
import { Button } from './ui/button'
export function Editor({
  resource,
  row,
  onClose,
}: {
  resource: Resource
  row?: Row
  onClose: () => void
}) {
  const { t } = useI18n()

  const { session } = useAuth(),
    client = useQueryClient()
  const uploadedFiles = useRef(new Map<File, string>())
  const [values, setValues] = useState<Record<string, any>>(() =>
    Object.fromEntries(
      resource.fields.map((f) => [
        f.key,
        row?.[f.key] ??
          f.default ??
          (f.type === 'multi' || f.type === 'files' || f.type === 'file'
            ? []
            : ''),
      ]),
    ),
  )
  const [pending, setPending] = useState(false),
    [progress, setProgress] = useState<
      { index: number; count: number } | 'saving' | null
    >(null),
    [error, setError] = useState<unknown>(null)
  const fields = resource.fields.filter(
    (f) => !(row && f.createOnly) && !(!row && f.editOnly),
  )
  async function save() {
    if (pending) return
    setError(null)
    setPending(true)
    try {
      if (
        !canManageResource(resource, session?.user) ||
        !(row ? resource.edit : resource.create)
      )
        throw new Error(t('Это действие недоступно для вашей учётной записи'))
      const body: Record<string, any> = {}
      for (const field of fields) {
        if (field.type === 'separator' || !canUseField(field, session?.user))
          continue
        const value = values[field.key]
        if (
          field.required &&
          (value == null ||
            (typeof value === 'string' && !value.trim()) ||
            (Array.isArray(value) && !value.length))
        )
          throw new Error(
            t('Заполните поле «{field}»', { field: t(field.label) }),
          )
        if (field.key === 'password' && !value) {
          if (!row) throw new Error(t('Укажите пароль нового пользователя'))
          continue
        }
        if (
          field.type === 'number' &&
          value != null &&
          (!Number.isFinite(value) || value < (field.min ?? 0))
        )
          throw new Error(
            t('«{field}»: минимальное значение {min}', {
              field: t(field.label),
              min: field.min ?? 0,
            }),
          )
        body[field.key] = value === '' ? null : value
      }
      if (resource.upload) {
        const key = resource.key === 'accounts' ? 'files' : 'file_name'
        const files = values[key]
        if (Array.isArray(files) && files.length) {
          if (key === 'file_name' && files.length !== 1)
            throw new Error(t('Для версии нужен один APK-файл'))
          const extension = key === 'files' ? '.tar.gz' : '.apk'
          if (
            files.some(
              (file: File) =>
                !(file instanceof File) ||
                !file.name.toLowerCase().endsWith(extension),
            )
          )
            throw new Error(t('Выберите файлы {extension}', { extension }))
          const uploaded: string[] = []
          for (const [index, file] of (files as File[]).entries()) {
            setProgress({ index: index + 1, count: files.length })
            let filename = uploadedFiles.current.get(file)
            if (!filename) {
              const unique =
                crypto.randomUUID?.() ??
                Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
                  byte.toString(16).padStart(2, '0'),
                ).join('')
              const baseName = file.name
                .slice(0, -extension.length)
                .replace(/[^a-zA-Z0-9._-]/g, '_')
              const safeName = `${unique}-${baseName}${extension}`
              const result = await uploadFile(
                resource.upload,
                new File([file], safeName, { type: file.type }),
              )
              filename = result.file_name as string
              uploadedFiles.current.set(file, filename)
            }
            uploaded.push(filename)
          }
          body[key] = key === 'files' ? uploaded : uploaded[0]
        }
      }
      if (resource.key === 'accounts' && !row) delete body.status
      if (resource.key === 'android' && !row && !body.user_id)
        body.user_id = session?.user.id
      setProgress('saving')
      const result = await api(resource.endpoint + (row ? row.id : ''), {
        method: row ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      })
      await Promise.all([
        client.invalidateQueries({ queryKey: ['rows'] }),
        client.invalidateQueries({ queryKey: ['options'] }),
      ])
      toast.success(
        resource.key === 'accounts' && !row
          ? t('Добавлено аккаунтов: {count}', { count: result.count })
          : row
            ? t('Изменения сохранены')
            : t('Запись создана'),
      )
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setPending(false)
      setProgress(null)
    }
  }
  const progressText =
    progress === 'saving'
      ? t('Сохранение…')
      : progress
        ? t('Загрузка файла {index} из {count}…', progress)
        : ''
  return (
    <Modal
      open
      onOpenChange={(v) => !v && !pending && onClose()}
      title={`${row ? t('Редактировать') : t('Создать')}: ${t(resource.singular)}`}
      description={
        resource.key === 'accounts'
          ? t(
              'Загрузите архивы аккаунтов и задайте лимит отправки и время паузы.',
            )
          : resource.key === 'versions'
            ? t('Выберите APK-файл приложения и добавьте описание версии.')
            : t('Заполните поля и сохраните изменения.')
      }
      footer={
        <>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            {t('Отмена')}
          </Button>
          <Button disabled={pending} type="submit" form="resource-editor">
            {pending ? progressText || t('Сохранение…') : t('Сохранить')}
          </Button>
        </>
      }
    >
      <form
        id="resource-editor"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        {error != null && <ErrorBox error={error} />}
        <fieldset disabled={pending} className="min-w-0">
          <FormFields
            fields={fields}
            values={values}
            editing={!!row}
            onChange={(key, value) =>
              setValues((current) => ({ ...current, [key]: value }))
            }
          />
        </fieldset>
        {pending && (
          <p role="status" className="text-xs text-muted-foreground">
            {progressText}
          </p>
        )}
      </form>
    </Modal>
  )
}
