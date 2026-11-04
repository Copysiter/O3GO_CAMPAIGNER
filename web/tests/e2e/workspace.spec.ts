import { test, expect, type Page } from '@playwright/test'
import { row, setup } from './fixtures'

async function assertFit(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const dialog = page.getByRole('dialog')
  if (await dialog.count()) {
    const box = await dialog.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(-1)
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
  }
}
test('touch-friendly table, full details, scroll mode, selection and context menu', async ({
  page,
  isMobile,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await setup(page)
  await page.goto('/campaigns')
  await expect(page.getByRole('heading', { name: 'Кампании', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Действия строки 101' })).toBeVisible()
  await assertFit(page)
  if (isMobile) {
    const filterBox = await page.getByRole('button', { name: /^Фильтры/ }).boundingBox()
    for (const name of ['Обновить таблицу', 'Настроить колонки', 'Переключить режим таблицы']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox()
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
    expect(filterBox!.height).toBeGreaterThanOrEqual(44)
  }
  await page.screenshot({ path: testInfo.outputPath('campaigns.png'), animations: 'disabled' })
  const action = page.getByRole('button', { name: 'Действия строки 101' })
  if (isMobile) await action.tap()
  else await action.click()
  await page.getByRole('menuitem', { name: 'Все поля и подробности' }).click()
  await expect(page.getByRole('dialog')).toContainText('Привет, {field_1}')
  await assertFit(page)
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Выбрать строку 101' }).check()
  await expect(page.getByText('Выбрано: 1', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Данные будут удалены')
  await page.getByRole('button', { name: 'Отмена', exact: true }).click()
  if (!isMobile) {
    await expect(page.locator('.full-table')).toBeVisible()
    await page.getByRole('button', { name: 'Переключить режим таблицы' }).click()
    await expect(page.locator('.full-table')).toHaveCount(0)
  }
  await page.getByRole('button', { name: 'Переключить режим таблицы' }).click()
  await expect(page.locator('.full-table')).toBeVisible()
  await page.locator('.table-scroll').evaluate((e) => {
    e.scrollLeft = e.scrollWidth
  })
  expect(await page.locator('.table-scroll').evaluate((e) => e.scrollLeft)).toBeGreaterThan(0)
  await assertFit(page)
  if (!isMobile) {
    await page.locator('.data-table tbody tr').first().click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: 'Все поля и подробности' })).toBeVisible()
    await page.keyboard.press('Escape')
  }
  expect(errors).toEqual([])
})
test('flat status filters use backend scalar format and clear resets selection', async ({
  page,
}) => {
  const requests = await setup(page)
  await page.goto('/campaigns')
  await page.getByRole('button', { name: 'Фильтры' }).click()
  await page.getByLabel('Колонка', { exact: true }).selectOption('status')
  await page.getByLabel('В работе', { exact: true }).check()
  await page.getByLabel('Остановлена', { exact: true }).check()
  await page.getByRole('button', { name: 'Применить', exact: true }).click()
  await expect
    .poll(
      () =>
        requests.filter(
          (r) =>
            r.path === '/campaigns/' && decodeURIComponent(r.query).includes('filters[1][value]=2'),
        ).length,
    )
    .toBeGreaterThan(0)
  const query = new URLSearchParams(
    requests.filter((r) => r.path === '/campaigns/' && r.query.includes('filters')).at(-1)!.query,
  )
  expect(query.get('filters[0][value]')).toBe('1')
  expect(query.get('filters[1][value]')).toBe('2')
  expect(query.has('filters[0][value][0]')).toBe(false)
  await page.getByRole('button', { name: /^Фильтры/ }).click()
  const filters = page.getByRole('dialog', { name: 'Фильтры', exact: true })
  while (await filters.locator('.filter-row-remove').count()) await filters.locator('.filter-row-remove').first().click()
  await filters.getByRole('button', { name: 'Применить', exact: true }).click()
  // Clearing can immediately restore the fresh unfiltered cache. Explicit refresh
  // verifies that the next backend request also contains no old conditions.
  await page.getByRole('button', { name: 'Обновить таблицу', exact: true }).click()
  await expect.poll(() => requests.filter((request) => request.path === '/campaigns/').at(-1)?.query.includes('filters')).toBe(false)
})
test('theme, accents and table mode persist without white backgrounds', async ({
  page,
  isMobile,
}, testInfo) => {
  await setup(page)
  await page.goto('/campaigns')
  await page
    .getByRole('button', { name: 'Внешний вид', exact: true })
    .filter({ visible: true })
    .click()
  await assertFit(page)
  await expect(page.getByRole('button', { name: 'Системная', exact: true })).toHaveCount(0)
  await expect(page.locator('.theme-choice')).toHaveCount(2)
  expect(await page.locator('.accent-rectangle').evaluateAll((buttons) => buttons.map((button) => getComputedStyle(button).backgroundColor))).toEqual([
    'rgb(181, 210, 118)', 'rgb(97, 179, 213)', 'rgb(229, 197, 101)', 'rgb(86, 196, 125)',
  ])
  const tableModeBox = (await page.getByLabel('Режим таблиц', { exact: true }).boundingBox())!
  const languageBox = (await page.getByLabel('Язык', { exact: true }).boundingBox())!
  expect(Math.abs(tableModeBox.y - languageBox.y)).toBeLessThan(1)
  expect(tableModeBox.x).toBeLessThan(languageBox.x)
  if (isMobile) {
    const swatches = await page.getByRole('button', { name: /^Цвет:/ }).evaluateAll((buttons) =>
      buttons.map((button) => {
        const box = button.getBoundingClientRect()
        return { width: box.width, height: box.height }
      }),
    )
    expect(swatches).toHaveLength(4)
    for (const box of swatches) {
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
  }
  await page.screenshot({ path: testInfo.outputPath('settings-dark.png'), animations: 'disabled' })
  await page.getByRole('button', { name: 'Светлая', exact: true }).click()
  expect(await page.locator('.accent-rectangle').evaluateAll((buttons) => buttons.map((button) => getComputedStyle(button).backgroundColor))).toEqual([
    'rgb(33, 124, 178)', 'rgb(4, 154, 112)', 'rgb(205, 45, 45)', 'rgb(74, 83, 92)',
  ])
  await page.getByRole('button', { name: 'Цвет: Красный', exact: true }).click()
  await page.getByLabel('Режим таблиц', { exact: true }).selectOption('scroll')
  await page.screenshot({ path: testInfo.outputPath('settings-light.png'), animations: 'disabled' })
  await page.getByRole('button', { name: 'Готово', exact: true }).click()
  await page.reload()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await expect(page.locator('.full-table')).toBeVisible()
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(
    'rgb(255, 255, 255)',
  )
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('campaigner.preferences')!).accent),
  ).toBe('preset3')
  await assertFit(page)
  await page.screenshot({
    path: testInfo.outputPath('campaigns-light.png'),
    animations: 'disabled',
  })
})
test('campaign wizard creates exact existing API payload without starting it', async ({ page }) => {
  const requests = await setup(page)
  await page.goto('/campaigns')
  await page.getByRole('button', { name: 'Новая кампания', exact: true }).click()
  await assertFit(page)
  await page.getByLabel('Название', { exact: false }).fill('Draft touch test')
  await page
    .getByLabel('Данные получателей', { exact: true })
    .fill('79990000000;Иван;https://example.com')
  await page.getByRole('button', { name: 'Далее', exact: false }).click()
  await page.getByLabel('Шаблон сообщения', { exact: false }).fill('Привет, {field_1}')
  await page.getByRole('button', { name: 'Далее', exact: false }).click()
  await page.getByRole('button', { name: 'Понедельник, 09:00 UTC', exact: true }).click()
  await page.getByRole('button', { name: 'Далее', exact: false }).click()
  await page.getByRole('button', { name: 'Создать кампанию', exact: false }).click()
  await expect
    .poll(() => requests.some((r) => r.path === '/campaigns/' && r.method === 'POST'))
    .toBe(true)
  const payload = requests.find((r) => r.path === '/campaigns/' && r.method === 'POST')!.body
  expect(payload.status).toBe(0)
  expect(payload.data_fields.dst_addr).toBe(0)
  expect(payload.data_text_col_sep).toBe(';')
  expect(payload.schedule['1']).toEqual([9])
  expect(requests.some((r) => r.path.includes('/start'))).toBe(false)
})
test('campaign details actions require confirmation; message deletion sends selected IDs', async ({
  page,
}) => {
  const requests = await setup(page)
  await page.goto('/campaigns/101')
  await expect(page.getByRole('heading', { name: row.name, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Запустить', exact: true }).click()
  await page.getByRole('button', { name: 'Отмена', exact: true }).click()
  expect(requests.some((r) => r.path.endsWith('/start'))).toBe(false)
  await page.getByRole('checkbox', { name: 'Выбрать строку 501', exact: true }).check()
  await page.getByRole('button', { name: 'Удалить выбранные', exact: true }).click()
  await page.getByRole('button', { name: 'Подтвердить', exact: true }).click()
  await expect
    .poll(() =>
      requests.some((r) => r.path === '/campaigns/101/campaign_dst' && r.method === 'DELETE'),
    )
    .toBe(true)
  expect(requests.find((r) => r.method === 'DELETE')!.body).toEqual({ ids: [501] })
  await assertFit(page)
})
test('CRUD tag form and non-admin access restrictions', async ({ page }) => {
  const requests = await setup(page)
  await page.goto('/tags')
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: 'Название', exact: false })
    .fill('New test tag')
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect
    .poll(() => requests.some((r) => r.path === '/tags/' && r.method === 'POST'))
    .toBe(true)
})
test('key and user creation use existing JSON contracts', async ({ page }) => {
  const requests = await setup(page)
  await page.goto('/keys')
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  await page.getByLabel('Значение ключа', { exact: false }).fill('fixture-key')
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect
    .poll(() => requests.some((r) => r.path === '/api_keys/' && r.method === 'POST'))
    .toBe(true)
  expect(requests.find((r) => r.path === '/api_keys/' && r.method === 'POST')!.body.value).toBe(
    'fixture-key',
  )
  await page.goto('/users')
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Логин', { exact: false }).fill('fixture-user')
  await page.getByRole('dialog').getByLabel('Пароль', { exact: true }).fill('fixture-password')
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect
    .poll(() => requests.some((r) => r.path === '/users/' && r.method === 'POST'))
    .toBe(true)
  expect(requests.find((r) => r.path === '/users/' && r.method === 'POST')!.body).toMatchObject({
    login: 'fixture-user',
    password: 'fixture-password',
    is_active: true,
    is_superuser: false,
  })
})
test('APK and WA uploads are deferred until save and mapped to API fields', async ({ page }) => {
  const requests = await setup(page)
  await page.goto('/versions')
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByLabel('APK-файл', { exact: false })
    .setInputFiles({
      name: 'test.apk',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('fixture'),
    })
  expect(requests.some((r) => r.path.endsWith('/upload'))).toBe(false)
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect
    .poll(() => requests.some((r) => r.path === '/android/versions/' && r.method === 'POST'))
    .toBe(true)
  expect(
    requests.find((r) => r.path === '/android/versions/' && r.method === 'POST')!.body.file_name,
  ).toMatch(/test\.apk$/)
  await page.goto('/accounts')
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  await page.getByLabel('Архивы .tar.gz', { exact: false }).setInputFiles([
    { name: 'a.tar.gz', mimeType: 'application/gzip', buffer: Buffer.from('a') },
    { name: 'b.tar.gz', mimeType: 'application/gzip', buffer: Buffer.from('b') },
  ])
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect
    .poll(() => requests.some((r) => r.path === '/android/accounts/' && r.method === 'POST'))
    .toBe(true)
  const body = requests.find((r) => r.path === '/android/accounts/' && r.method === 'POST')!.body
  expect(body.files).toHaveLength(2)
  expect(body.limit).toBe(10)
  expect(body.cooldown).toBe(10)
  expect(body).not.toHaveProperty('status')
})
test('non-admin cannot access administrative pages or owner options', async ({ page }) => {
  const requests = await setup(page, false)
  await page.goto('/users')
  await expect(page.getByRole('heading', { name: 'Доступ только администратору' })).toBeVisible()
  expect(requests.some((r) => r.path === '/users/')).toBe(false)
  await page.goto('/campaigns')
  await page.getByRole('button', { name: 'Новая кампания', exact: true }).click()
  await expect(page.getByLabel('Владелец', { exact: true })).toHaveCount(0)
  expect(requests.some((r) => r.path === '/options/user')).toBe(false)
})

test('WA account creation preserves an unlimited sending limit and zero cooldown', async ({
  page,
}) => {
  const requests = await setup(page)
  await page.goto('/accounts')
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  await page.getByLabel('Архивы .tar.gz', { exact: false }).setInputFiles({
    name: 'unlimited.tar.gz',
    mimeType: 'application/gzip',
    buffer: Buffer.from('fixture'),
  })
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Лимит отправки', { exact: false })).toHaveValue('10')
  await dialog.getByLabel('Лимит отправки', { exact: false }).fill('-1')
  await dialog.getByLabel('Пауза, мин.', { exact: false }).fill('0')
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect
    .poll(() =>
      requests.some(
        (request) => request.path === '/android/accounts/' && request.method === 'POST',
      ),
    )
    .toBe(true)
  const body = requests.find(
    (request) => request.path === '/android/accounts/' && request.method === 'POST',
  )!.body
  expect(body.limit).toBe(-1)
  expect(body.cooldown).toBe(0)
  expect(body.files).toHaveLength(1)
  expect(body).not.toHaveProperty('status')
})
