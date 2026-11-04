import { expect, test, type Page } from '@playwright/test'
import { row, setup, user } from './fixtures'

async function settled(page: Page) {
  await expect(page.locator('.data-table tbody tr').first()).toBeVisible()
  await expect(page.locator('.table-loading-overlay')).toHaveCount(0)
}

async function mockLargeTable(page: Page) {
  const requests = await setup(page)
  let delayed = false
  let release: (() => void) | undefined
  let completed = 0
  await page.route('**/api/v1/campaigns/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname !== '/api/v1/campaigns/' || request.method() !== 'GET') {
      await route.fallback()
      return
    }
    const skip = Number(url.searchParams.get('skip') || 0)
    const limit = Number(url.searchParams.get('limit') || 20)
    if (limit > 1 && delayed) {
      delayed = false
      await new Promise<void>((resolve) => {
        release = resolve
      })
    }
    const data = Array.from({ length: Math.min(limit, 100 - skip) }, (_, index) => ({
      ...row,
      id: 101 + skip + index,
      name: `Fixture campaign ${skip + index + 1}`,
    }))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data, total: 100 }),
    })
    if (limit > 1) completed += 1
  })
  return {
    requests,
    completed: () => completed,
    waitForPending: () => expect.poll(() => !!release).toBe(true),
    delayNext: () => {
      delayed = true
    },
    resume: async () => {
      await expect.poll(() => !!release).toBe(true)
      const resolve = release!
      release = undefined
      resolve()
    },
  }
}

test('sidebar defaults to a 60px rail, remembers expansion and exposes a circular profile control', async ({
  page,
  isMobile,
}) => {
  await setup(page)
  await page.goto('/campaigns')
  await settled(page)
  await expect(
    page.locator('a[href="/android"], a[href="/versions"], a[href="/accounts"]'),
  ).toHaveCount(0)
  if (isMobile) {
    await expect(page.locator('.sidebar')).not.toBeVisible()
    await page.getByRole('button', { name: 'Открыть меню', exact: true }).tap()
    await expect(page.locator('.mobile-sidebar')).toBeVisible()
    await expect(page.locator('.mobile-sidebar .sidebar-profile .user-avatar')).toBeVisible()
    await page.getByRole('button', { name: 'Закрыть меню', exact: true }).tap()
    await expect(page.locator('.mobile-sidebar')).toHaveCount(0)
    return
  }
  await expect(page.locator('.app-shell')).toHaveClass(/sidebar-collapsed/)
  expect((await page.locator('.sidebar').boundingBox())!.width).toBe(60)
  const profile = page.locator('.sidebar-profile .user-avatar')
  await expect(profile).toBeVisible()
  const circle = await profile.evaluate((node) => {
    const box = node.getBoundingClientRect()
    return {
      width: box.width,
      height: box.height,
      radius: getComputedStyle(node).borderRadius,
    }
  })
  expect(circle.width).toBe(circle.height)
  expect(circle.radius === '50%' || parseFloat(circle.radius) >= circle.width / 2).toBe(true)
  await page.getByRole('button', { name: 'Развернуть сайдбар', exact: true }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/sidebar-expanded/)
  expect((await page.locator('.sidebar').boundingBox())!.width).toBeGreaterThan(180)
  expect(await page.evaluate(() => localStorage.getItem('campaigner.sidebar.expanded'))).toBe(
    'true',
  )
  await page.reload()
  await expect(page.locator('.app-shell')).toHaveClass(/sidebar-expanded/)
  await expect(page.getByRole('button', { name: 'Свернуть сайдбар', exact: true })).toBeVisible()
})

test('automatic table view follows viewport size and reserves ID subtitles for compact rows', async ({
  page,
  isMobile,
}, testInfo) => {
  await mockLargeTable(page)
  await page.goto('/campaigns')
  await settled(page)
  await expect(page.locator('.data-table-stage')).toHaveAttribute(
    'data-mode',
    isMobile ? 'compact' : 'scroll',
  )
  await expect(page.getByRole('textbox', { name: 'Быстрый поиск', exact: true })).toHaveCount(0)
  await expect(page.getByText('УПРАВЛЕНИЕ / campaigns', { exact: true })).toHaveCount(0)
  await expect(
    page.getByText('Сообщения, аудитории и контроль доставки', { exact: true }),
  ).toHaveCount(0)
  const firstRow = page.locator('.data-table tbody tr').first()
  await expect(firstRow.getByText('#101', { exact: true })).toHaveCount(isMobile ? 1 : 0)
  if (!isMobile) {
    await expect(page.locator('.full-table')).toBeVisible()
    await expect(firstRow).toContainText(user.name)
    const id = await page.locator('.data-table thead .id-column').boundingBox()
    expect(id!.width).toBeLessThanOrEqual(72)
  }
  if (page.viewportSize()!.width <= 320) {
    const boxes = await Promise.all(
      [
        'Фильтры',
        'Обновить таблицу',
        'Настроить колонки',
        'Переключить режим таблицы',
        'Новая кампания',
      ].map((name) =>
        page.locator('.table-controls').getByRole('button', { name, exact: true }).boundingBox(),
      ),
    )
    for (const box of boxes) {
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
      expect(Math.abs(box!.y - boxes[0]!.y)).toBeLessThan(1)
    }
  }
  const controls = page.locator('.table-controls')
  const order = await controls
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')))
  expect(order.indexOf('Новая кампания')).toBe(order.indexOf('Переключить режим таблицы') + 1)
  if (isMobile) {
    await expect(controls.getByText('Обновить', { exact: true })).not.toBeVisible()
    await expect(controls.getByText('Новая кампания', { exact: true })).not.toBeVisible()
    for (const name of ['Обновить таблицу', 'Новая кампания']) {
      const box = (await controls.getByRole('button', { name, exact: true }).boundingBox())!
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
  }
  await page.screenshot({
    path: testInfo.outputPath('layout-default.png'),
    animations: 'disabled',
  })
})

test('CSS layout fills the remaining height and keeps statistics fixed during native table scrolling', async ({
  page,
  browserName,
  isMobile,
}, testInfo) => {
  await mockLargeTable(page)
  await page.goto('/campaigns')
  await settled(page)
  const body = page.locator('.resource-body')
  const stage = page.locator('.data-table-stage')
  const scroller = page.locator('.table-scroll')
  const footer = page.locator('.table-pagination')
  const stats = page.locator('.resource-stats')
  const header = page.locator('.workspace-header')
  const bottomGap = async () => {
    const contentBottom = await body.evaluate((node) => {
      const box = node.getBoundingClientRect()
      return box.bottom - parseFloat(getComputedStyle(node).paddingBottom)
    })
    const box = (await footer.boundingBox())!
    return contentBottom - box.y - box.height
  }
  const pageOverflow = () =>
    page.evaluate(() => ({
      x: document.documentElement.scrollWidth - innerWidth,
      y: document.documentElement.scrollHeight - innerHeight,
    }))
  await expect.poll(async () => Math.abs(await bottomGap())).toBeLessThanOrEqual(4)
  await expect.poll(async () => (await pageOverflow()).y).toBeLessThanOrEqual(1)
  expect((await pageOverflow()).x).toBeLessThanOrEqual(1)
  expect(await stage.evaluate((node) => node.style.height)).toBe('')
  expect(await body.evaluate((node) => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(
    1,
  )
  const before = {
    stats: (await stats.boundingBox())!,
    stage: (await stage.boundingBox())!,
    header: (await header.boundingBox())!,
    footer: (await footer.boundingBox())!,
  }
  await scroller.hover()
  if (browserName === 'webkit' && isMobile) await scroller.press('PageDown')
  else await page.mouse.wheel(0, 1000)
  await expect.poll(() => scroller.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
  expect(await body.evaluate((node) => node.scrollTop)).toBe(0)
  for (const [name, locator] of [
    ['stats', stats],
    ['stage', stage],
    ['header', header],
    ['footer', footer],
  ] as const) {
    const after = (await locator.boundingBox())!
    expect(Math.abs(after.y - before[name].y)).toBeLessThan(1)
    expect(Math.abs(after.height - before[name].height)).toBeLessThan(1)
  }
  const headerOnTop = await page.locator('thead th.row-actions').evaluate((node) => {
    const box = node.getBoundingClientRect()
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    return !!hit?.closest('thead')
  })
  expect(headerOnTop).toBe(true)
  await expect.poll(async () => Math.abs(await bottomGap())).toBeLessThanOrEqual(4)
  await page.screenshot({
    path: testInfo.outputPath('layout-table-native.png'),
    animations: 'disabled',
  })
})

test('pagination and explicit refresh preserve old rows behind a centered loading overlay', async ({
  page,
}) => {
  const backend = await mockLargeTable(page)
  await page.goto('/campaigns')
  await settled(page)
  backend.delayNext()
  await page.getByRole('button', { name: 'Следующая страница', exact: true }).click()
  await expect(page.locator('.table-loading-overlay')).toBeVisible()
  await expect(page.locator('.data-table')).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('button', { name: 'Следующая страница', exact: true })).toBeDisabled()
  await expect(page.locator('.data-table tbody tr').first()).toContainText('Fixture campaign 1')
  await backend.resume()
  await expect(page.locator('.table-loading-overlay')).toHaveCount(0)
  await expect(page.locator('.data-table tbody tr').first()).toContainText('Fixture campaign 21')
  backend.delayNext()
  await page.getByRole('button', { name: 'Обновить таблицу', exact: true }).click()
  await expect(page.locator('.table-loading-overlay')).toBeVisible()
  await expect(page.locator('.data-table tbody tr').first()).toContainText('Fixture campaign 21')
  await expect(page.getByRole('button', { name: 'Обновить таблицу', exact: true })).toBeDisabled()
  await backend.resume()
  await expect(page.locator('.table-loading-overlay')).toHaveCount(0)
})

test('minute polling stays quiet while explicit refresh shows a foreground loading overlay', async ({
  page,
}) => {
  await page.clock.install()
  const backend = await mockLargeTable(page)
  await page.goto('/campaigns')
  await settled(page)
  const before = backend.completed()
  backend.delayNext()
  await page.clock.fastForward(61000)
  await backend.waitForPending()
  await expect(page.locator('.table-loading-overlay')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Обновить таблицу', exact: true })).toBeEnabled()
  await expect(page.locator('.data-table')).toHaveAttribute('aria-busy', 'false')
  await backend.resume()
  await expect.poll(backend.completed).toBeGreaterThan(before)
  backend.delayNext()
  await page.getByRole('button', { name: 'Обновить таблицу', exact: true }).click()
  await backend.waitForPending()
  await expect(page.locator('.table-loading-overlay')).toBeVisible()
  await expect(page.locator('.data-table')).toHaveAttribute('aria-busy', 'true')
  await backend.resume()
  await expect(page.locator('.table-loading-overlay')).toHaveCount(0)
})

test('query invalidation after a campaign action does not cover the existing table with a loader', async ({
  page,
}) => {
  const backend = await mockLargeTable(page)
  await page.goto('/campaigns')
  await settled(page)
  await page.getByRole('button', { name: 'Действия строки 101', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Поставить на паузу', exact: true }).click()
  backend.delayNext()
  await page.getByRole('button', { name: 'Подтвердить', exact: true }).click()
  await backend.waitForPending()
  await expect(page.locator('.table-loading-overlay')).toHaveCount(0)
  await expect(page.locator('.data-table tbody tr').first()).toContainText('Fixture campaign 1')
  await backend.resume()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('native touch swipes scroll rows without moving the fixed statistics or opening a menu', async ({
  page,
  isMobile,
  browserName,
}) => {
  test.skip(!isMobile || browserName !== 'chromium', 'Requires Chromium CDP touch input')
  await mockLargeTable(page)
  await page.goto('/campaigns')
  await settled(page)
  const body = page.locator('.resource-body')
  const stats = page.locator('.resource-stats')
  const before = (await stats.boundingBox())!
  const scroller = page.locator('.table-scroll')
  const box = (await scroller.boundingBox())!
  const x = box.x + box.width / 2
  const from = Math.min(box.y + box.height - 20, page.viewportSize()!.height - 30)
  const to = Math.max(65, from - 450)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: from }] })
  for (let step = 1; step <= 15; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: from + ((to - from) * step) / 15 }],
    })
    await page.waitForTimeout(16)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect.poll(() => scroller.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
  expect(await body.evaluate((node) => node.scrollTop)).toBe(0)
  expect(Math.abs((await stats.boundingBox())!.y - before.y)).toBeLessThan(1)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('menu')).toHaveCount(0)
})

test('opening a column filter keeps initial focus away from native selectors', async ({ page }) => {
  await setup(page)
  await page.goto('/campaigns')
  await settled(page)
  await page.getByRole('button', { name: 'Фильтры', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Фильтры', exact: true })).toBeVisible()
  await expect(page.getByLabel('Колонка', { exact: true })).not.toBeFocused()
  await expect(page.getByLabel('Оператор', { exact: true })).not.toBeFocused()
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('SELECT')
})

test('short landscape screens keep table controls, rows and pagination inside the viewport', async ({
  page,
}, testInfo) => {
  await setup(page)
  for (const viewport of [
    { width: 667, height: 375 },
    { width: 568, height: 320 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/campaigns/101')
    await settled(page)
    const scroller = (await page.locator('.table-scroll').boundingBox())!
    const pagination = (await page.locator('.table-pagination').boundingBox())!
    expect(scroller.height).toBeGreaterThanOrEqual(80)
    expect(pagination.y + pagination.height).toBeLessThanOrEqual(viewport.height)
    expect(
      await page
        .locator('.resource-body')
        .evaluate((node) => node.scrollHeight - node.clientHeight),
    ).toBeLessThanOrEqual(1)
    await expect(
      page.getByRole('checkbox', { name: 'Выбрать строку 501', exact: true }),
    ).toBeVisible()
    await page.getByRole('checkbox', { name: 'Выбрать строку 501', exact: true }).check()
    await expect(page.getByRole('button', { name: 'Удалить выбранные', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Снять выбор', exact: true }).click()
    await page.screenshot({
      path: testInfo.outputPath(`landscape-${viewport.width}.png`),
      animations: 'disabled',
    })
  }
})

test('two fixed themes expose four paired accent rectangles and English persists immediately', async ({
  page,
  isMobile,
}, testInfo) => {
  await mockLargeTable(page)
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/campaigns')
  await settled(page)
  await page
    .getByRole('button', { name: 'Внешний вид', exact: true })
    .filter({ visible: true })
    .click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Тёмная', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Светлая', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Системная', exact: true })).toHaveCount(0)
  await expect(dialog.locator('.accent-swatch')).toHaveCount(4)
  await expect(dialog.locator('.theme-material > span')).toHaveCount(6)
  const colors = () =>
    dialog
      .locator('.accent-swatch')
      .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor))
  expect(await colors()).toEqual([
    'rgb(181, 210, 118)',
    'rgb(97, 179, 213)',
    'rgb(229, 197, 101)',
    'rgb(86, 196, 125)',
  ])
  if (isMobile) {
    for (const target of await dialog.locator('.accent-swatch').evaluateAll((nodes) =>
      nodes.map((node) => ({
        width: node.getBoundingClientRect().width,
        height: node.getBoundingClientRect().height,
      })),
    )) {
      expect(target.width).toBeGreaterThanOrEqual(44)
      expect(target.height).toBeGreaterThanOrEqual(44)
    }
  }
  await page.screenshot({ path: testInfo.outputPath('settings-dark.png'), animations: 'disabled' })
  await dialog.getByRole('button', { name: 'Светлая', exact: true }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  expect(await colors()).toEqual([
    'rgb(33, 124, 178)',
    'rgb(4, 154, 112)',
    'rgb(205, 45, 45)',
    'rgb(74, 83, 92)',
  ])
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(
    'rgb(255, 255, 255)',
  )
  await dialog.locator('[data-color="preset2"]').click()
  await page.getByLabel('Язык', { exact: true }).selectOption('en')
  await expect(page.getByRole('dialog', { name: 'Appearance', exact: true })).toBeVisible()
  await expect(page.getByLabel('Language', { exact: true })).toHaveValue('en')
  await expect(page.getByRole('button', { name: 'Light', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.screenshot({
    path: testInfo.outputPath('settings-english.png'),
    animations: 'disabled',
  })
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Campaigns', exact: true })).toBeVisible()
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.reload()
  await settled(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await expect(page.locator('.data-table tbody tr').first()).toContainText('Fixture campaign 1')
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('campaigner.preferences')!)),
  ).toMatchObject({
    version: 2,
    theme: 'light',
    language: 'en',
    accent: 'preset2',
    tableMode: 'auto',
  })
  await page.screenshot({ path: testInfo.outputPath('layout-english.png'), animations: 'disabled' })
})
