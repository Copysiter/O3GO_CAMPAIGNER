import { expect, test } from '@playwright/test'
import { authHeaders, login } from './session'

test('campaign list matches any selected API key and combines keys with other conditions', async ({ page }) => {
  await login(page)
  const headers = await authHeaders(page)
  const prefix = `E2E-key-filter-${Date.now()}`
  const cleanup: string[] = []
  const create = async (resource: string, data: object) => {
    const response = await page.request.post(`/api/v1/${resource}/`, { headers, data })
    expect(response.ok(), `Create ${resource}: ${response.status()}`).toBeTruthy()
    const { id } = await response.json()
    cleanup.unshift(`/api/v1/${resource}/${id}`)
    return id as number
  }
  try {
    const a = prefix + '-A', b = prefix + '-B'
    const keyIds = [await create('api_keys', { value: a }), await create('api_keys', { value: b })]
    const first = await create('campaigns', { name: prefix + '-first', api_keys: [a] })
    const second = await create('campaigns', { name: prefix + '-second', api_keys: [b] })
    const both = await create('campaigns', { name: prefix + '-both', api_keys: [a, b] })
    await create('campaigns', { name: prefix + '-neither' })

    const filters = page.getByRole('dialog', { name: 'Фильтры', exact: true })
    const popup = page.getByRole('dialog', { name: 'Значение фильтра', exact: true })
    const open = () => page.getByRole('button', { name: /^Фильтры/ }).click()
    const row = (suffix: string) => page.getByRole('row').filter({ hasText: prefix + '-' + suffix })
    const apply = async () => {
      const result = page.waitForResponse(response => {
        const url = new URL(response.url())
        return url.pathname === '/api/v1/campaigns/' && url.searchParams.get('filters[0][field]') === 'api_keys'
      })
      await filters.getByRole('button', { name: 'Применить', exact: true }).click()
      const response = await result
      expect(response.ok()).toBe(true)
      return response
    }
    await open()
    await filters.getByLabel('Колонка', { exact: true }).selectOption('api_keys')
    const trigger = filters.getByRole('button', { name: 'Значение фильтра', exact: true })
    await trigger.click()
    await popup.getByRole('textbox').fill(prefix)
    await popup.getByRole('checkbox', { name: a, exact: true }).check()
    await popup.getByRole('checkbox', { name: b, exact: true }).check()
    await expect(trigger).toHaveText('Выбрано: 2')
    await trigger.click()
    const response = await apply()
    const params = new URL(response.url()).searchParams
    expect([params.get('filters[0][value]'), params.get('filters[1][value]')]).toEqual(keyIds.map(String))
    const result = await response.json()
    expect(result.total).toBe(3)
    expect(result.data.map((row: { id: number }) => row.id).sort()).toEqual([first, second, both].sort())
    for (const suffix of ['first', 'second', 'both'])
      await expect(row(suffix)).toBeVisible()
    await expect(row('neither')).toHaveCount(0)

    await open()
    await filters.getByRole('button', { name: 'Добавить условие' }).click()
    const extra = filters.getByRole('group', { name: 'Условие 2' })
    await extra.getByLabel('Колонка', { exact: true }).selectOption('name')
    await extra.getByRole('textbox').fill(prefix + '-both')
    const narrowed = await (await apply()).json()
    expect(narrowed.total).toBe(1)
    expect(narrowed.data[0].id).toBe(both)
    await expect(row('both')).toBeVisible()
    await expect(row('first')).toHaveCount(0)
  } finally {
    for (const path of cleanup) {
      const response = await page.request.delete(path, { headers })
      expect.soft(response.ok(), `Cleanup ${path}: ${response.status()}`).toBeTruthy()
    }
  }
})
