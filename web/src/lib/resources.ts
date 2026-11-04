export type Field = {
  key: string
  label: string
  type?: string
  required?: boolean
  options?: string
  choices?: [string | number, string][]
  admin?: boolean
  permission?: string
  default?: any
  help?: string
  min?: number
  span?: 1 | 2
  fullWhenNoOwner?: boolean
  inline?: boolean
  createOnly?: boolean
  editOnly?: boolean
}
export type Column = {
  key: string
  label: string
  type?: string
  filter?: boolean
  sort?: boolean
  primary?: boolean
  options?: string
  choices?: [string | number, string][]
}
export type Resource = {
  key: string
  title: string
  singular: string
  description: string
  endpoint: string
  columns: Column[]
  fields: Field[]
  admin?: boolean
  create?: boolean
  edit?: boolean
  upload?: string
  permissionPrefix?: string
  notice?: string
}
export const campaignStatuses: [number, string][] = [
  [-1, 'На паузе'],
  [0, 'Создана'],
  [1, 'В работе'],
  [2, 'Остановлена'],
  [3, 'Завершена'],
]
export const messageStatuses: [number, string][] = [
  [-1, 'Подготовка'],
  [0, 'Создано'],
  [1, 'Отправлено'],
  [2, 'Доставлено'],
  [3, 'Не доставлено'],
  [4, 'Ошибка'],
]
export const accountStatuses: [number, string][] = [
  [-1, 'Заблокирован'],
  [0, 'Доступен'],
  [1, 'Активен'],
  [2, 'Пауза'],
]
const c = (
  key: string,
  label: string,
  type = 'text',
  extra: Partial<Column> = {},
): Column => ({
  key,
  label,
  type,
  filter: true,
  sort: true,
  ...extra,
})
const f = (
  key: string,
  label: string,
  type = 'text',
  extra: Partial<Field> = {},
): Field => ({
  key,
  label,
  type,
  ...extra,
})
const separator = (key: string, extra: Partial<Field> = {}) =>
  f(key, '', 'separator', { span: 2, ...extra })
const id = c('id', 'ID', 'number')
const owner = c('user_id', 'Владелец', 'number', { options: 'user' })
const userField = f('user_id', 'Владелец', 'option', {
  options: 'user',
  admin: true,
})
export const campaignFields: Field[] = [
  f('name', 'Название', 'text', { required: true }),
  userField,
  f('webhook_url', 'Webhook URL', 'url'),
  f('api_keys', 'API-ключи', 'multi', {
    options: 'api_key',
    permission: 'campaign.assign_api_keys',
  }),
  f('androids', 'Android-устройства', 'multi', {
    options: 'android',
    permission: 'campaign.assign_androids',
  }),
  f('tags', 'Теги', 'multi', {
    options: 'tag',
    permission: 'campaign.assign_tags',
  }),
  f('msg_template', 'Шаблон сообщения', 'textarea', {
    help: '{field_1} … {field_5}; [short]https://example.com[/short]',
  }),
  f('order', 'Приоритет', 'number', { default: 1 }),
  f('msg_attempts', 'Попытки отправки', 'number', { default: 1 }),
  f('msg_sending_timeout', 'Таймаут отправки, сек.', 'number', {
    default: 3600,
  }),
  f('msg_status_timeout', 'Таймаут статуса, сек.', 'number', {
    default: 86400,
  }),
  f('follow_limit', 'Лимит переходов', 'number', { default: 0 }),
  f('start_ts', 'Начало (UTC)', 'date'),
  f('stop_ts', 'Завершение (UTC)', 'date'),
]
export const messageColumns: Column[] = [
  id,
  c('dst_addr', 'Получатель', 'text', { primary: true }),
  c('status', 'Статус', 'enum', { choices: messageStatuses, primary: true }),
  c('text', 'Сообщение', 'text', { primary: true }),
  c('src_addr', 'Отправитель'),
  c('ext_id', 'Внешний ID'),
  c('attempts', 'Попытки', 'number'),
  c('ban_count', 'Баны', 'number'),
  c('clicked_link', 'Переход по ссылке', 'boolean', {
    filter: false,
    sort: false,
  }),
  c('reply_text', 'Ответ'),
  c('reply_ts', 'Время ответа', 'date'),
  ...Array.from({ length: 5 }, (_, i) => c(`field_${i + 1}`, `Поле ${i + 1}`)),
  c('score', 'Оценка', 'number'),
  c('error', 'Ошибка'),
  c('create_ts', 'Создано', 'date'),
  c('sent_ts', 'Отправлено', 'date'),
  c('update_ts', 'Обновлено', 'date'),
  c('expire_ts', 'Истекает', 'date'),
]
export const resources: Record<string, Resource> = {
  campaigns: {
    key: 'campaigns',
    permissionPrefix: 'campaign',
    title: 'Кампании',
    singular: 'кампания',
    description: 'Сообщения, аудитории и контроль доставки',
    endpoint: '/campaigns/',
    create: true,
    edit: true,
    fields: campaignFields,
    columns: [
      id,
      c('name', 'Кампания', 'text', { primary: true }),
      c('status', 'Статус', 'campaign-status', {
        choices: campaignStatuses,
        primary: true,
      }),
      owner,
      c('msg_total', 'Всего', 'number', { primary: true }),
      c('msg_delivered', 'Доставлено', 'number', { primary: true }),
      c('tags', 'Теги', 'tags', { options: 'tag', sort: false }),
      c('api_keys', 'API-ключи', 'text', { filter: false, sort: false }),
      c('android_names', 'Устройства', 'text', { filter: false, sort: false }),
      c('ban_count', 'Баны', 'number'),
      c('msg_template', 'Шаблон'),
      c('msg_sent', 'Отправлено', 'number'),
      c('msg_undelivered', 'Не доставлено', 'number'),
      c('msg_failed', 'Ошибки', 'number'),
      c('follow_count', 'Переходы', 'number'),
      c('link_clicks', 'Клики', 'number'),
      c('fake_clicks', 'Clicker', 'number'),
      c('create_ts', 'Создана', 'date'),
      c('start_ts', 'Начало', 'date'),
      c('stop_ts', 'Завершение', 'date'),
      c('order', 'Приоритет', 'number'),
      c('msg_attempts', 'Попытки', 'number'),
      c('msg_sending_timeout', 'Таймаут отправки', 'number'),
      c('msg_status_timeout', 'Таймаут статуса', 'number'),
      c('webhook_url', 'Webhook'),
    ],
  },
  tags: {
    key: 'tags',
    permissionPrefix: 'tags',
    title: 'Теги',
    singular: 'тег',
    description: 'Группы кампаний, цветовые метки и доступ API-ключей',
    endpoint: '/tags/',
    create: true,
    edit: true,
    columns: [
      id,
      c('name', 'Название', 'text', { primary: true }),
      owner,
      c('description', 'Описание', 'text', { primary: true }),
      c('api_keys', 'API-ключи', 'text', { filter: false, sort: false }),
      c('color_txt', 'Цвет текста'),
      c('color_bg', 'Цвет фона'),
    ],
    fields: [
      f('name', 'Название', 'text', { required: true, fullWhenNoOwner: true }),
      userField,
      f('api_keys', 'API-ключи', 'multi', { options: 'api_key' }),
      f('color_txt', 'Цвет текста', 'color', { default: '#e7e9e8' }),
      f('color_bg', 'Цвет фона', 'color', { default: '#167c63' }),
      f('description', 'Описание', 'textarea'),
      separator('sep1'),
    ],
  },
  keys: {
    key: 'keys',
    permissionPrefix: 'api_keys',
    title: 'API-ключи',
    singular: 'API-ключ',
    description: 'Доступ интеграций к кампаниям',
    endpoint: '/api_keys/',
    create: true,
    edit: true,
    columns: [
      id,
      c('value', 'Ключ', 'text', { primary: true }),
      owner,
      c('description', 'Описание', 'text', { primary: true }),
    ],
    fields: [
      f('value', 'Значение ключа', 'text', {
        required: true,
        fullWhenNoOwner: true,
      }),
      userField,
      f('description', 'Описание', 'textarea'),
      separator('sep1'),
    ],
  },
  users: {
    key: 'users',
    permissionPrefix: 'users',
    title: 'Пользователи',
    singular: 'пользователь',
    description: 'Команда, права и доступ к интеграциям',
    endpoint: '/users/',
    admin: true,
    create: true,
    edit: true,
    columns: [
      id,
      c('name', 'Имя', 'text', { primary: true }),
      c('login', 'Логин', 'text', { primary: true }),
      c('is_active', 'Активен', 'boolean', { primary: true }),
      c('is_superuser', 'Администратор', 'boolean'),
      c('ext_api_key', 'Внешний API-ключ'),
      c('api_keys', 'API-ключи', 'text', { filter: false, sort: false }),
      c('permissions', 'Права', 'text', { filter: false, sort: false }),
    ],
    fields: [
      f('name', 'Имя'),
      f('is_superuser', 'Роль', 'role', { default: false }),
      f('permissions', 'Права', 'multi', { options: 'permission' }),
      f('api_keys', 'API-ключи по умолчанию', 'multi', { options: 'api_key' }),
      separator('sep1'),
      f('login', 'Логин', 'text', { required: true }),
      f('password', 'Пароль', 'password', {
        help: 'При редактировании оставьте пустым, чтобы не менять пароль.',
      }),
      separator('sep2'),
      f('ext_api_key', 'Внешний API-ключ', 'text', { span: 2 }),
      separator('sep3'),
      f('is_active', 'Активен', 'boolean', {
        default: true,
        span: 2,
        inline: true,
      }),
      separator('sep4'),
    ],
  },
  android: {
    key: 'android',
    permissionPrefix: 'androids',
    title: 'Android',
    singular: 'устройство',
    description: 'Устройства, состояние и версии приложений',
    endpoint: '/androids/',
    notice: 'Редактирование устройств пока недоступно.',
    edit: false,
    create: true,
    columns: [
      id,
      c('device_name', 'Устройство', 'text', { primary: true }),
      c('is_active', 'Активно', 'boolean', { primary: true }),
      c('bat', 'Заряд, %', 'text', { primary: true }),
      owner,
      c('device', 'Идентификатор'),
      c('device_origin', 'Device origin'),
      c('type', 'Тип'),
      c('manufacturer', 'Производитель'),
      c('version', 'Версия приложения'),
      c('android_version', 'Android'),
      c('operator_name', 'Оператор'),
      c('charging', 'Зарядка'),
      c('push_id', 'Push ID'),
      c('info_data', 'Информация'),
    ],
    fields: [
      f('device_name', 'Название устройства', 'text', {
        required: true,
        fullWhenNoOwner: true,
      }),
      userField,
      f('device', 'Идентификатор устройства', 'text', { required: true }),
      f('device_origin', 'Идентификатор приложения', 'text', {
        required: true,
      }),
      separator('sep1'),
      f('type', 'Приложение', 'option', {
        required: true,
        default: '1',
        choices: [
          ['1', 'WhatsApp'],
          ['2', 'WhatsApp Business'],
        ],
      }),
      f('is_active', 'Активно', 'boolean', { default: true }),
      separator('sep2'),
      f('manufacturer', 'Производитель'),
      f('android_version', 'Версия Android'),
      f('version', 'Версия приложения'),
      f('operator_name', 'Оператор'),
      f('info_data', 'Дополнительная информация', 'textarea'),
      separator('sep3'),
    ],
  },
  versions: {
    key: 'versions',
    title: 'Версии APK',
    singular: 'версия',
    description: 'Пакеты Android-приложений',
    endpoint: '/android/versions/',
    admin: true,
    create: true,
    edit: true,
    upload: '/android/versions/upload',
    columns: [
      id,
      c('file_name', 'APK-файл', 'text', { primary: true }),
      c('description', 'Описание', 'text', { primary: true }),
    ],
    fields: [
      f('file_name', 'APK-файл', 'file', { required: true, span: 2 }),
      separator('sep2'),
      f('description', 'Описание', 'textarea'),
      separator('sep3'),
    ],
  },
  accounts: {
    key: 'accounts',
    title: 'WA-аккаунты',
    singular: 'аккаунт',
    description: 'Архивы WhatsApp, лимиты и паузы',
    endpoint: '/android/accounts/',
    admin: true,
    create: true,
    edit: true,
    upload: '/android/accounts/upload',
    columns: [
      id,
      c('file_name', 'Архив', 'text', { primary: true }),
      c('status', 'Статус', 'enum', {
        choices: accountStatuses,
        primary: true,
      }),
      owner,
      c('limit', 'Лимит', 'number'),
      c('cooldown', 'Пауза, мин.', 'number'),
      c('sent', 'Отправлено', 'number'),
      c('uuid', 'UUID', 'text', { filter: false }),
      c('create_ts', 'Создан', 'date'),
      c('update_ts', 'Использован', 'date'),
    ],
    fields: [
      f('limit', 'Лимит отправки', 'number', {
        default: 10,
        required: true,
        min: -1,
        help: '-1 — без ограничения количества сообщений.',
      }),
      f('cooldown', 'Пауза, мин.', 'number', { default: 10, required: true }),
      separator('sep0'),
      f('files', 'Архивы .tar.gz', 'files', {
        required: true,
        createOnly: true,
      }),
      separator('sep1', { createOnly: true }),
    ],
  },
}
export function messageResource(campaignId: number): Resource {
  return {
    key: `messages-${campaignId}`,
    title: 'Сообщения',
    singular: 'сообщение',
    description: 'Доставка, ответы и история отправки',
    endpoint: `/campaigns/${campaignId}/campaign_dst`,
    columns: messageColumns,
    fields: [],
    edit: false,
    create: false,
  }
}

export function hasPermission(
  user: { is_superuser?: boolean; permissions?: string[] } | null | undefined,
  permission: string,
) {
  return (
    !!user && (!!user.is_superuser || !!user.permissions?.includes(permission))
  )
}
export function canReadResource(
  resource: Resource,
  user: { is_superuser?: boolean; permissions?: string[] } | null | undefined,
) {
  return (
    !!user &&
    (!resource.admin || !!user.is_superuser) &&
    (!resource.permissionPrefix ||
      hasPermission(user, `${resource.permissionPrefix}.read`))
  )
}
export function canManageResource(
  resource: Resource,
  user: { is_superuser?: boolean; permissions?: string[] } | null | undefined,
) {
  return (
    !!user &&
    (!resource.admin || !!user.is_superuser) &&
    (!resource.permissionPrefix ||
      hasPermission(user, `${resource.permissionPrefix}.manage`))
  )
}
