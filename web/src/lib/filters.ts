export type Filter = {
  field: string
  operator: string
  value?: string | number | boolean | null | (string | number | null)[]
}
export const operators = {
  eq: 'Равно',
  neq: 'Не равно',
  gt: 'Больше',
  gte: 'Больше или равно',
  lt: 'Меньше',
  lte: 'Меньше или равно',
  contains: 'Содержит',
  doesnotcontain: 'Не содержит',
  startswith: 'Начинается с',
  endswith: 'Заканчивается на',
  isnull: 'Не задано (NULL)',
  isnotnull: 'Задано',
  isempty: 'Пустая строка',
  isnotempty: 'Не пустая строка',
  isnullorempty: 'Пусто или NULL',
  isnotnullorempty: 'Не пусто и не NULL',
  istrue: 'Да',
  isfalse: 'Нет',
  overlaps: 'Любое из выбранных',
  in: 'В списке',
} as const
export type Operator = keyof typeof operators
export const unary = new Set([
  'isnull',
  'isnotnull',
  'isempty',
  'isnotempty',
  'isnullorempty',
  'isnotnullorempty',
  'istrue',
  'isfalse',
])
export function allowedOperators(type: string): Operator[] {
  if (type === 'campaign-status' || type === 'tags') return ['overlaps']
  if (type === 'boolean') return ['istrue', 'isfalse', 'isnull', 'isnotnull']
  if (type === 'enum') return ['eq', 'neq', 'in', 'isnull', 'isnotnull']
  if (type === 'number' || type === 'date')
    return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'isnull', 'isnotnull']
  return [
    'eq',
    'neq',
    'contains',
    'doesnotcontain',
    'startswith',
    'endswith',
    'isnull',
    'isnotnull',
    'isempty',
    'isnotempty',
    'isnullorempty',
    'isnotnullorempty',
  ]
}
// Keep filters flat: the campaign endpoint itself merges status/tag scalar values.
export function serializeQuery(
  filters: Filter[],
  orders: { id: string; desc: boolean }[],
  page = 0,
  size = 25,
  campaign = false,
) {
  const params = new URLSearchParams({ skip: String(page * size), limit: String(size) })
  const flattened = filters.flatMap((f) =>
    campaign && ['status', 'tags'].includes(f.field)
      ? (Array.isArray(f.value) ? f.value : [f.value]).map((value) => ({
          ...f,
          operator: 'eq',
          value,
        }))
      : [f],
  )
  flattened.forEach((f, i) => {
    params.set(`filters[${i}][field]`, f.field)
    params.set(`filters[${i}][operator]`, f.operator)
    if (!unary.has(f.operator)) {
      if (Array.isArray(f.value))
        f.value.forEach((v, j) =>
          params.set(`filters[${i}][value][${j}]`, v === null ? 'null' : String(v)),
        )
      else params.set(`filters[${i}][value]`, f.value == null ? 'null' : String(f.value))
    }
  })
  orders.forEach((o, i) => {
    params.set(`orders[${i}][field]`, o.id)
    params.set(`orders[${i}][dir]`, o.desc ? 'desc' : 'asc')
  })
  return params.toString()
}
