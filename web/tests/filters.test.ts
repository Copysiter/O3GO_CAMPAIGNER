import { describe, it, expect } from 'vitest'
import { serializeQuery, allowedOperators, unary, operators } from '../src/lib/filters'
import { messageResource, resources } from '../src/lib/resources'
describe('existing FastAPI query contract', () => {
  it('encodes flat filters, pagination and order with bracket notation', () => {
    const q = new URLSearchParams(
      serializeQuery(
        [{ field: 'name', operator: 'contains', value: 'a+b & c=1' }],
        [{ id: 'create_ts', desc: true }],
        2,
        25,
      ),
    )
    expect(q.get('skip')).toBe('50')
    expect(q.get('limit')).toBe('25')
    expect(q.get('filters[0][value]')).toBe('a+b & c=1')
    expect(q.get('orders[0][field]')).toBe('create_ts')
    expect(q.get('orders[0][dir]')).toBe('desc')
    expect([...q.keys()].some((k) => k.includes('logic') || k.includes('[filters]'))).toBe(false)
  })
  it('flattens campaign status, tag and API key selections to repeated scalar predicates', () => {
    const q = new URLSearchParams(
      serializeQuery(
        [
          { field: 'status', operator: 'overlaps', value: [-1, 1] },
          { field: 'tags', operator: 'overlaps', value: [2, 3] },
          { field: 'api_keys', operator: 'overlaps', value: [7, 11] },
        ],
        [],
        0,
        10,
        true,
      ),
    )
    expect(q.get('filters[0][value]')).toBe('-1')
    expect(q.get('filters[1][value]')).toBe('1')
    expect(q.get('filters[2][field]')).toBe('tags')
    expect(q.get('filters[3][value]')).toBe('3')
    expect(q.get('filters[4][field]')).toBe('api_keys')
    expect(q.get('filters[4][operator]')).toBe('eq')
    expect(q.get('filters[4][value]')).toBe('7')
    expect(q.get('filters[5][field]')).toBe('api_keys')
    expect(q.get('filters[5][operator]')).toBe('eq')
    expect(q.get('filters[5][value]')).toBe('11')
    expect([...q.keys()].some((k) => k.includes('[value]['))).toBe(false)
  })
  it('filters campaigns by API key ID while the campaign form uses key values', () => {
    const column = resources.campaigns.columns.find((column) => column.key === 'api_keys')!
    expect(column).toMatchObject({ filter: true, sort: false, options: 'api_key_id' })
    expect(allowedOperators(column.type!)).toEqual(['overlaps'])
    expect(resources.campaigns.fields.find((field) => field.key === 'api_keys')?.options).toBe('api_key')
  })
  it('retains native in arrays for other endpoints', () => {
    const q = new URLSearchParams(
      serializeQuery([{ field: 'status', operator: 'in', value: [1, 2] }], []),
    )
    expect(q.get('filters[0][operator]')).toBe('in')
    expect(q.get('filters[0][value][0]')).toBe('1')
  })
  it('filters campaign messages by any of the selected delivery statuses', () => {
    const column = messageResource(42).columns.find((column) => column.key === 'status')!
    const available = allowedOperators(column.type!)
    expect(available).toEqual(['overlaps', 'eq', 'neq', 'isnull', 'isnotnull'])
    expect(column.choices?.map(([value]) => value)).toEqual([-1, 0, 1, 2, 3, 4, 'null'])
    const q = new URLSearchParams(
      serializeQuery([{ field: 'status', operator: available[0], value: [0, 2, 'null'] }], []),
    )
    expect(q.get('filters[0][operator]')).toBe('overlaps')
    expect(q.get('filters[0][value][0]')).toBe('0')
    expect(q.get('filters[0][value][1]')).toBe('2')
    expect(q.get('filters[0][value][2]')).toBe('null')
  })
  it.each([...unary])('sends unary %s without bogus value', (op) => {
    const q = new URLSearchParams(serializeQuery([{ field: 'name', operator: op }], []))
    expect(q.has('filters[0][value]')).toBe(false)
  })
  it('preserves zero and empty text values', () => {
    const q = new URLSearchParams(
      serializeQuery(
        [
          { field: 'order', operator: 'eq', value: 0 },
          { field: 'name', operator: 'eq', value: '' },
        ],
        [],
      ),
    )
    expect(q.get('filters[0][value]')).toBe('0')
    expect(q.get('filters[1][value]')).toBe('')
  })
  it('only offers comparison operators supported by each endpoint/type', () => {
    expect(allowedOperators('campaign-status')).toEqual(['overlaps'])
    expect(allowedOperators('tags')).toEqual(['overlaps'])
    expect(allowedOperators('number')).toContain('gte')
    expect(allowedOperators('number')).not.toContain('contains')
    expect(allowedOperators('text')).toEqual(
      expect.arrayContaining([
        'startswith',
        'endswith',
        'doesnotcontain',
        'isnullorempty',
        'isnotnullorempty',
      ]),
    )
    expect(allowedOperators('boolean')).toEqual(['istrue', 'isfalse', 'isnull', 'isnotnull'])
    for (const type of ['text', 'date', 'enum', 'number', 'tags', 'boolean'])
      for (const op of allowedOperators(type)) expect(operators[op]).toBeTruthy()
  })
})
