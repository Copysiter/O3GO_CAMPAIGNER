import { expect, test, type Page } from '@playwright/test'
import { row, setup } from './fixtures'

async function columnWidths(page: Page, keys: string[]) {
  const table = page.locator('.data-table')
  const cellsLocator = table.locator('tbody tr').first().locator('td.table-data-column')
  await expect(cellsLocator).toHaveCount(keys.length)
  const cells = await cellsLocator.evaluateAll((cells) =>
    cells.map((cell) => {
      const { left, right, width } = cell.getBoundingClientRect()
      return { key: cell.getAttribute('data-column-id'), left, right, width }
    }),
  )
  expect(cells.map((cell) => cell.key)).toEqual(keys)
  const select = (await table.locator('tbody td[data-column-id="select"]').first().boundingBox())!
  const action = (await table.locator('tbody td.row-actions').first().boundingBox())!
  const viewport = await page.locator('.table-scroll').evaluate((node) => ({
    right: node.getBoundingClientRect().left + node.clientLeft + node.clientWidth,
    overflow: node.scrollWidth - node.clientWidth,
  }))
  expect(viewport.overflow).toBeLessThanOrEqual(1)
  let right = select.x + select.width
  for (const cell of cells) {
    expect(Math.abs(cell.left - right), cell.key || '').toBeLessThanOrEqual(1)
    right = cell.right
  }
  expect(Math.abs(cells.at(-1)!.right - action.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(action.x + action.width - viewport.right)).toBeLessThanOrEqual(1)
  return cells.map((cell) => cell.width)
}

async function checkHeaderControls(page: Page, key: string, label: string, mobile: boolean) {
  const header = page.locator(`thead th[data-column-id="${key}"]`)
  const sort = header.getByRole('button', { name: label, exact: true })
  await expect(sort).toBeVisible()
  const bounds = await sort.evaluate((button) => {
    const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT)
    const text = walker.nextNode()!
    const range = document.createRange()
    range.selectNodeContents(text)
    const label = range.getBoundingClientRect()
    const arrow = button.querySelector('svg')!.getBoundingClientRect()
    const cell = button.closest('th')!.getBoundingClientRect()
    return {
      labelLeft: label.left,
      labelRight: label.right,
      arrowLeft: arrow.left,
      arrowRight: arrow.right,
      arrowWidth: arrow.width,
      cellLeft: cell.left,
      cellRight: cell.right,
    }
  })
  expect(bounds.labelLeft).toBeGreaterThanOrEqual(bounds.cellLeft)
  expect(bounds.labelRight).toBeLessThanOrEqual(bounds.arrowLeft + 1)
  expect(bounds.arrowWidth).toBeGreaterThan(0)
  const filter = header.locator('button[aria-label^="Filter:"], button[aria-label^="Фильтр:"]')
  if (mobile) {
    await expect(filter).toBeHidden()
    expect(bounds.arrowRight).toBeLessThanOrEqual(bounds.cellRight + 1)
  } else {
    await expect(filter).toBeVisible()
    const box = (await filter.boundingBox())!
    expect(bounds.arrowRight).toBeLessThanOrEqual(box.x + 1)
    expect(box.x + box.width).toBeLessThanOrEqual(bounds.cellRight + 1)
  }
}

for (const language of ['en', 'ru'] as const) {
  test(`compact columns pack to the left and localized headers fit (${language})`, async ({
    page,
    isMobile,
  }) => {
    await setup(page)
    await page.addInitScript((language) => {
      localStorage.setItem('campaigner.preferences', JSON.stringify({ version: 2, language, tableMode: 'compact' }))
    }, language)
    await page.route('**/api/v1/campaigns/?*', (route) =>
      route.fulfill({ json: { data: [{ ...row, name: 'VIP' }], total: 1 } }),
    )
    const labels = language === 'en'
      ? { name: 'Name', status: 'Status', msg_total: 'Total', msg_delivered: 'Delivered' }
      : { name: 'Название', status: 'Статус', msg_total: 'Всего', msg_delivered: 'Доставлено' }
    const keys: (keyof typeof labels)[] = isMobile
      ? ['name', 'status']
      : ['name', 'status', 'msg_total', 'msg_delivered']
    const narrow = isMobile ? 320 : 1440
    const wide = isMobile ? 390 : 1640
    await page.setViewportSize({ width: narrow, height: isMobile ? 844 : 1000 })
    await page.goto('/campaigns')
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    await expect(page.locator('.data-table-stage')).toHaveAttribute('data-mode', 'compact')
    await expect(page.locator('tbody .table-primary-value')).toContainText('VIP')
    await page.evaluate(() => document.fonts.ready)

    const resize = async (width: number) => {
      await page.setViewportSize({ width, height: isMobile ? 844 : 1000 })
      await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }))
    }
    const checkExpansion = async () => {
      const before = await columnWidths(page, keys)
      await resize(wide)
      await expect(async () => {
        const after = await columnWidths(page, keys)
        for (let i = 0; i < keys.length - 1; i++)
          expect(Math.abs(after[i] - before[i]), keys[i]).toBeLessThanOrEqual(1)
        expect(after.at(-1)! - before.at(-1)!).toBeCloseTo(wide - narrow, 0)
      }).toPass()
      for (const key of keys) await checkHeaderControls(page, key, labels[key], isMobile)
    }
    await checkExpansion()

    const lastKey = keys.pop()!
    await page.getByRole('button', {
      name: language === 'en' ? 'Configure columns' : 'Настроить колонки',
      exact: true,
    }).click()
    const priority = page.getByRole('menuitemcheckbox', { name: labels[lastKey], exact: true })
    await priority.click()
    await priority.click()
    await page.keyboard.press('Escape')
    keys.unshift(lastKey)
    await resize(narrow)
    await checkExpansion()
  })
}
