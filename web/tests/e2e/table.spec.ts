import { test, expect, type Page } from '@playwright/test'
import { row, setup } from './fixtures'

const tableHeader = (page: Page, name: string) =>
  page.locator('.data-table thead th').filter({ hasText: name })

test('per-table column priorities, hidden columns and mode survive reloads', async ({ page }) => {
  await setup(page)
  await page.goto('/campaigns')
  await expect(page.locator('.data-table')).toBeVisible()
  await page.getByRole('button', { name: 'Настроить колонки', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Компактный', exact: true }).click()
  await expect(page.locator('.full-table')).toHaveCount(0)

  await page.getByRole('button', { name: 'Настроить колонки', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: 'ID', exact: true }).click()
  await expect(page.getByRole('menuitemcheckbox', { name: 'ID', exact: true })).toBeChecked()
  await page.keyboard.press('Escape')
  await expect(tableHeader(page, 'ID')).toHaveCount(1)
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('table:campaigns')!).compactKeys[0]),
  ).toBe('id')

  await page.getByRole('button', { name: 'Переключить режим таблицы', exact: true }).click()
  await expect(page.locator('.full-table')).toBeVisible()
  await page.getByRole('button', { name: 'Настроить колонки', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Владелец', exact: true }).click()
  await expect(
    page.getByRole('menuitemcheckbox', { name: 'Владелец', exact: true }),
  ).not.toBeChecked()
  await page.keyboard.press('Escape')
  await expect(tableHeader(page, 'Владелец')).toHaveCount(0)

  await page.reload()
  await expect(page.locator('.full-table')).toBeVisible()
  await expect(tableHeader(page, 'Владелец')).toHaveCount(0)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('table:campaigns')!))
  expect(saved.mode).toBe('scroll')
  expect(saved.hidden).toContain('user_id')
  expect(saved.compactKeys[0]).toBe('id')

  await page.getByRole('button', { name: 'Переключить режим таблицы', exact: true }).click()
  await page.reload()
  await expect(page.locator('.data-table')).toBeVisible()
  await expect(page.locator('.full-table')).toHaveCount(0)
  await expect(tableHeader(page, 'ID')).toHaveCount(1)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('table:campaigns')!).mode)).toBe(
    'compact',
  )
})

test('flat filter drafts apply together, cancel safely and remain inside the popup', async ({
  page,
  isMobile,
}) => {
  const requests = await setup(page)
  const tableQueries = () =>
    requests.filter(
      (request) =>
        request.path === '/campaigns/' && new URLSearchParams(request.query).get('limit') !== '1',
    )
  const lastQuery = () => new URLSearchParams(tableQueries().at(-1)?.query || '')
  await page.goto('/campaigns')
  await expect(page.locator('.data-table tbody tr').first()).toBeVisible()
  const before = tableQueries().length
  await page.getByRole('button', { name: 'Фильтры', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Фильтры', exact: true })
  const rows = dialog.locator('.filter-row')
  await rows.nth(0).getByLabel('Колонка', { exact: true }).selectOption('name')
  await rows.nth(0).getByLabel('Оператор', { exact: true }).selectOption('contains')
  await rows.nth(0).getByLabel('Значение фильтра', { exact: true }).fill('first condition')
  await dialog.getByRole('button', { name: 'Добавить условие', exact: true }).click()
  await rows.nth(1).getByLabel('Колонка', { exact: true }).selectOption('msg_total')
  await rows.nth(1).getByLabel('Оператор', { exact: true }).selectOption('gte')
  await rows.nth(1).getByLabel('Значение фильтра', { exact: true }).fill('50')
  await dialog.getByRole('button', { name: 'Добавить условие', exact: true }).click()
  await rows.nth(2).getByLabel('Колонка', { exact: true }).selectOption('msg_total')
  await rows.nth(2).getByLabel('Оператор', { exact: true }).selectOption('lte')
  await rows.nth(2).getByLabel('Значение фильтра', { exact: true }).fill('500')
  expect(tableQueries()).toHaveLength(before)
  await dialog.getByRole('button', { name: 'Применить', exact: true }).click()
  await expect.poll(() => lastQuery().get('filters[2][value]')).toBe('500')
  expect(lastQuery().get('filters[0][field]')).toBe('name')
  expect(lastQuery().get('filters[1][operator]')).toBe('gte')
  expect(lastQuery().get('filters[2][field]')).toBe('msg_total')
  expect(lastQuery().get('filters[2][operator]')).toBe('lte')
  expect(
    [...lastQuery().keys()].some((key) => key.includes('[filters]') || key.includes('logic')),
  ).toBe(false)
  await expect(page.locator('.filter-chip')).toHaveCount(0)
  const applied = lastQuery().toString()
  await page.getByRole('button', { name: 'Фильтры', exact: true }).click()
  await expect(rows).toHaveCount(3)
  await rows.nth(0).getByLabel('Значение фильтра', { exact: true }).fill('cancelled change')
  await rows.nth(1).getByRole('button', { name: 'Удалить условие 2', exact: true }).click()
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
  expect(lastQuery().toString()).toBe(applied)
  await page.getByRole('button', { name: 'Фильтры', exact: true }).click()
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0).getByLabel('Значение фильтра', { exact: true })).toHaveValue(
    'first condition',
  )
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
  if (!isMobile) {
    await page.getByRole('button', { name: 'Фильтр: Ошибки', exact: true }).click()
    await expect(rows).toHaveCount(4)
    await expect(rows.nth(3).getByLabel('Колонка', { exact: true })).toHaveValue('msg_failed')
    await expect(rows.nth(0).getByLabel('Значение фильтра', { exact: true })).toHaveValue(
      'first condition',
    )
    await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
  }
  await page.getByRole('button', { name: 'Фильтры', exact: true }).click()
  while (await rows.count())
    await rows
      .last()
      .getByRole('button', { name: /Удалить условие/ })
      .click()
  await dialog.getByRole('button', { name: 'Применить', exact: true }).click()
  await expect(page.locator('.filter-count')).toHaveCount(0)
})

test('only campaigns show the numeric statistics widgets', async ({ page }) => {
  await setup(page)
  await page.goto('/tags')
  await expect(page.getByRole('checkbox', { name: 'Выбрать строку 2', exact: true })).toBeVisible()
  await expect(page.locator('.resource-stats')).toHaveCount(0)
  await page.goto('/campaigns')
  await expect(page.locator('.resource-stats .resource-stat')).toHaveCount(3)
})

test('data columns pack to the left before the empty filler and action column', async ({
  page,
  isMobile,
}) => {
  await setup(page)
  await page.goto('/tags')
  await expect(page.locator('.table-loading-overlay')).toHaveCount(0)
  const firstRow = page.locator('.data-table tbody tr').first()
  await expect(firstRow).toBeVisible()
  const order = await firstRow
    .locator('td')
    .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-column-id')))
  expect(order.slice(-2)).toEqual(['spacer', 'actions'])
  await expect(page.locator('thead th.table-spacer')).toHaveText('')
  await expect(page.locator('thead th.table-spacer')).toHaveAttribute('aria-hidden', 'true')
  if (!isMobile) {
    const spacer = (await firstRow.locator('.table-spacer').boundingBox())!
    expect(spacer.width).toBeGreaterThan(100)
    const checkbox = (await page
      .getByRole('checkbox', { name: 'Выбрать строки этой страницы', exact: true })
      .boundingBox())!
    expect(Math.abs(checkbox.width - checkbox.height)).toBeLessThan(1)
    expect(checkbox.width).toBeLessThanOrEqual(24)
  }
})

test('entity detail titles identify tags and retain ungrouped IDs and API key badges', async ({
  page,
  isMobile,
}) => {
  await setup(page)
  await page.route('**/api/v1/tags/**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{ id: 123456, name: 'VIP', api_keys: ['fixture-key'], description: 'Fixture' }],
        total: 1,
      }),
    })
  })
  await page.goto('/tags')
  await expect(page.locator('.table-loading-overlay')).toHaveCount(0)
  if (!isMobile) await expect(page.locator('tbody td.id-column')).toHaveText('123456')
  await page.getByRole('button', { name: 'Действия строки 123456', exact: true }).click()
  await expect(page.getByText('Тег #123456', { exact: true })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Все поля и подробности', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Тег · #123456', exact: true })
  await expect(dialog).toBeVisible()
  await expect(
    dialog
      .locator('.record-detail-field')
      .filter({ has: page.getByText('ID', { exact: true }) })
      .locator('dd'),
  ).toHaveText('123456')
  await expect(dialog.locator('.value-chip-api-key')).toHaveText('fixture-key')
})

test('message IDs migrate to hidden once and an explicit column choice persists', async ({
  page,
}) => {
  await setup(page)
  await page.addInitScript(() => {
    if (!localStorage.getItem('table:messages-101'))
      localStorage.setItem('table:messages-101', JSON.stringify({ mode: 'scroll', hidden: [] }))
  })
  await page.goto('/campaigns/101')
  await expect(
    page.getByRole('checkbox', { name: 'Выбрать строку 501', exact: true }),
  ).toBeVisible()
  await expect(page.locator('thead .id-column')).toHaveCount(0)
  const migrated = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('table:messages-101')!),
  )
  expect(migrated.version).toBe(2)
  expect(migrated.hidden).toContain('id')
  await page.getByRole('button', { name: 'Настроить колонки', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Горизонтальная прокрутка', exact: true }).click()
  await page.getByRole('button', { name: 'Настроить колонки', exact: true }).click()
  await expect(page.getByRole('menuitemcheckbox', { name: 'ID', exact: true })).not.toBeChecked()
  await page.getByRole('menuitemcheckbox', { name: 'ID', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.locator('tbody td.id-column')).toHaveText('501')
  await page.reload()
  await expect(page.locator('tbody td.id-column')).toHaveText('501')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('table:messages-101')!))
  expect(saved.version).toBe(2)
  expect(saved.hidden).not.toContain('id')
})

test('filter popup uses desktop rows of three fields and a left add action', async ({
  page,
  isMobile,
}) => {
  await setup(page)
  await page.goto('/campaigns')
  await page.getByRole('button', { name: 'Фильтры', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Фильтры', exact: true })
  await expect(dialog).toHaveAttribute('data-size', 'default')
  await dialog.evaluate(async (node) => {
    await Promise.all(node.getAnimations().map((animation) => animation.finished.catch(() => {})))
  })
  if (!isMobile) {
    const box = (await dialog.boundingBox())!
    expect(box.width).toBeGreaterThan(480)
    expect(box.width).toBeLessThanOrEqual(780)
    const fields = await dialog.locator('.filter-row').evaluate((row) =>
      ['.filter-row-property select', '.filter-row-operator select', '.filter-row-value input'].map(
        (selector) => {
          const box = row.querySelector(selector)!.getBoundingClientRect()
          return { left: box.left, right: box.right, bottom: box.bottom }
        },
      ),
    )
    expect(fields[0].right).toBeLessThan(fields[1].left)
    expect(fields[1].right).toBeLessThan(fields[2].left)
    for (const field of fields)
      expect(Math.abs(field.bottom - fields[0].bottom)).toBeLessThanOrEqual(1)
  }
  const add = dialog.getByRole('button', { name: 'Добавить условие', exact: true })
  expect(await add.textContent()).toBe('')
  expect((await add.boundingBox())!.x).toBeLessThan(
    (await dialog.getByRole('button', { name: 'Отмена', exact: true }).boundingBox())!.x,
  )
  await add.click()
  await expect(dialog.locator('.filter-row')).toHaveCount(2)
})

test('dense campaign columns retain intrinsic widths instead of equal percentage widths', async ({
  page,
}) => {
  await setup(page)
  await page.goto('/campaigns')
  await page.getByRole('button', { name: 'Настроить колонки', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Горизонтальная прокрутка', exact: true }).click()
  await expect(page.locator('.full-table')).toBeVisible()
  await expect
    .poll(() => page.locator('thead th.table-data-column').count())
    .toBeGreaterThanOrEqual(20)
  const short = (await page.locator('thead th[data-column-id="msg_total"]').boundingBox())!
  const long = (await page.locator('thead th[data-column-id="msg_status_timeout"]').boundingBox())!
  expect(long.width - short.width).toBeGreaterThan(8)
  const extent = await page
    .locator('.table-scroll')
    .evaluate((node) => ({ content: node.scrollWidth, viewport: node.clientWidth }))
  expect(extent.content).toBeGreaterThan(extent.viewport)
})

test('sticky message actions stay below the table header after native scrolling in full view', async ({
  page,
  browserName,
}, testInfo) => {
  await setup(page)
  await page.route(/\/api\/v1\/campaigns\/101\/campaign_dst(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    const data = Array.from({ length: 100 }, (_, index) => ({
      id: 501 + index,
      campaign_id: 101,
      dst_addr: `7999000${String(index).padStart(4, '0')}`,
      status: 2,
      text: `Message ${index + 1}. `.repeat(10),
    }))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data, total: 100 }),
    })
  })
  await page.goto('/campaigns/101')
  await expect(page.locator('.data-table tbody tr')).toHaveCount(100)
  await expect(page.locator('.table-loading-overlay')).toHaveCount(0)
  await page.getByRole('button', { name: 'Настроить колонки', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Горизонтальная прокрутка', exact: true }).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.locator('.data-table tbody tr').first()).toBeVisible()
  const scroller = page.locator('.table-scroll')
  expect(await scroller.evaluate((node) => node.scrollHeight - node.clientHeight)).toBeGreaterThan(
    0,
  )
  if (browserName === 'webkit') {
    // Radix restores focus after menu dismissal. Wait for that step before
    // focusing the scroll region for Safari's native keyboard scrolling.
    await expect(page.getByRole('button', { name: 'Настроить колонки', exact: true })).toBeFocused()
    await scroller.focus()
    await expect(scroller).toBeFocused()
    await scroller.press('PageDown')
  } else {
    await scroller.hover()
    await page.mouse.wheel(0, 1000)
  }
  await expect.poll(() => scroller.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
  await scroller.evaluate((node) => {
    node.scrollLeft = node.scrollWidth
  })
  const header = page.locator('thead th.row-actions')
  await expect(header).toBeVisible()
  const headerOwnsPoint = () =>
    header.evaluate((node) => {
      const box = node.getBoundingClientRect()
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
      return hit?.closest('thead') === node.closest('thead')
    })
  await expect.poll(headerOwnsPoint).toBe(true)
  await expect(page.getByRole('menu')).toHaveCount(0)
  await page.screenshot({
    path: testInfo.outputPath('message-actions-header.png'),
    animations: 'disabled',
  })
})

test('compact column priorities keep localized numbers intact and give names available space', async ({
  page,
}) => {
  await setup(page)
  await page.route('**/api/v1/campaigns/**', async (route) => {
    if (
      route.request().method() !== 'GET' ||
      new URL(route.request().url()).pathname !== '/api/v1/campaigns/'
    ) {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{ ...row, name: 'Новая аудитория, 2', msg_total: 1000000 }],
        total: 1,
      }),
    })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/campaigns')
  await expect(page.locator('.table-loading-overlay')).toHaveCount(0)
  await page.getByRole('button', { name: 'Настроить колонки', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Компактный', exact: true }).click()
  await page.getByRole('button', { name: 'Настроить колонки', exact: true }).click()
  for (const name of ['Всего', 'Кампания']) {
    const checkbox = page.getByRole('menuitemcheckbox', { name, exact: true })
    await checkbox.click()
    await checkbox.click()
  }
  await page.keyboard.press('Escape')
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    const count = page.locator('tbody td[data-column-id="msg_total"] .tabular-nums')
    await expect(count).toBeVisible()
    expect((await count.textContent())!.replace(/\s/g, '')).toBe('1000000')
    const lines = await count.evaluate((node) => {
      const range = document.createRange()
      range.selectNodeContents(node)
      return range.getClientRects().length
    })
    expect(lines).toBe(1)
    await expect
      .poll(() =>
        page.locator('.table-scroll').evaluate((node) => node.scrollWidth - node.clientWidth),
      )
      .toBeLessThanOrEqual(1)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1)
    if (width === 390) {
      const lines = await page.locator('tbody .table-primary-value').evaluate((node) => {
        const text = node.firstChild!
        const range = document.createRange()
        range.setStart(text, 0)
        range.setEnd(text, text.textContent!.length)
        return range.getClientRects().length
      })
      expect(lines).toBe(1)
    }
  }
})
