import { expect, test } from '@playwright/test'
import { authHeaders, login } from './session'

test('campaign messages match either selected status, including Created (0)', async ({ page }) => {
  await login(page)
  const headers = await authHeaders(page)
  const name = `E2E-message-status-${Date.now()}`
  const campaign = await page.request.post('/api/v1/campaigns/', {
    headers, data: { name, status: -1 },
  })
  await expect(campaign).toBeOK()
  const { id } = await campaign.json()
  const campaignPath = `/api/v1/campaigns/${id}`
  const recipients = [
    { dst_addr: '12025550101', status: 0 },
    { dst_addr: '12025550102', status: 2 },
    { dst_addr: '12025550103', status: 1 },
  ]

  try {
    for (const recipient of recipients) {
      const created = await page.request.post('/api/v1/campaign_dst/', {
        headers, data: { ...recipient, campaign_id: id, ext_id: null, attempts: 0 },
      })
      await expect(created).toBeOK()
    }

    await page.reload()
    await page.getByRole('button', { name: new RegExp(name) }).click()
    await expect(page).toHaveURL(`/campaigns/${id}`)
    const row = (phone: string) => page.getByRole('row').filter({ hasText: phone })
    for (const recipient of recipients) await expect(row(recipient.dst_addr)).toBeVisible()

    await page.getByRole('button', { name: 'Фильтры', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Фильтры', exact: true })
    await dialog.getByLabel('Колонка', { exact: true }).selectOption('status')
    const trigger = dialog.getByRole('button', { name: 'Значение фильтра', exact: true })
    await trigger.click()
    const options = page.getByRole('dialog', { name: 'Значение фильтра', exact: true })
    for (const label of ['Создано', 'Доставлено']) {
      await options.getByRole('checkbox', { name: label, exact: true }).check()
    }
    await expect(trigger).toHaveText('Выбрано: 2')
    await trigger.click()

    const filtered = page.waitForResponse(response => {
      const url = new URL(response.url())
      return url.pathname === `${campaignPath}/campaign_dst` &&
        url.searchParams.get('filters[0][field]') === 'status'
    })
    await dialog.getByRole('button', { name: 'Применить', exact: true }).click()
    const response = await filtered
    expect(response.ok()).toBe(true)
    const query = new URL(response.url()).searchParams
    expect(query.get('filters[0][operator]')).toBe('overlaps')
    expect([query.get('filters[0][value][0]'), query.get('filters[0][value][1]')].sort())
      .toEqual(['0', '2'])
    const result = await response.json()
    expect(result.total).toBe(2)
    expect(result.data).toHaveLength(2)
    for (const recipient of recipients.slice(0, 2)) {
      expect(result.data).toContainEqual(expect.objectContaining(recipient))
      await expect(row(recipient.dst_addr)).toBeVisible()
    }
    await expect(row(recipients[2].dst_addr)).toHaveCount(0)
  } finally {
    const removed = await page.request.delete(campaignPath, { headers })
    await expect(removed).toBeOK()
  }
})
