import { test, expect, type Locator, type Page } from '@playwright/test'
import { setup, user } from './fixtures'

async function settled(page: Page) {
  await expect(page.locator('.data-table-stage')).toBeVisible()
  await expect(page.locator('.table-loading-overlay')).toHaveCount(0)
}
async function appearance(page: Page, theme: 'Тёмная' | 'Светлая') {
  await page
    .locator('.workspace-header')
    .getByRole('button', { name: 'Внешний вид', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Внешний вид', exact: true })
  await dialog.getByRole('button', { name: theme, exact: true }).click()
  await dialog.getByRole('button', { name: 'Готово', exact: true }).click()
}
async function addForm(page: Page, path: string) {
  await page.goto(path)
  await settled(page)
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  return page.getByRole('dialog')
}
async function formOrder(dialog: Locator) {
  return dialog.locator('.form-grid').evaluate((grid) =>
    Array.from(grid.children).map((element) => {
      const separator = element.getAttribute('data-separator')
      if (separator) return separator
      const control = element.querySelector(
        'input,select,textarea,[role="switch"]',
      )
      return control?.id.replace(/^field-/, '')
    }),
  )
}
async function sameControls(page: Page) {
  await page.mouse.move(0, 0)
  const buttons = [
    page.getByRole('button', { name: 'Обновить таблицу', exact: true }),
    page.getByRole('button', { name: 'Настроить колонки', exact: true }),
    page.getByRole('button', {
      name: 'Переключить режим таблицы',
      exact: true,
    }),
  ]
  const paints = () =>
    Promise.all(
      buttons.map((button) =>
        button.evaluate((element) => {
          const style = getComputedStyle(element)
          return {
            image: style.backgroundImage,
            color: style.backgroundColor,
            border: style.borderColor,
          }
        }),
      ),
    )
  await expect
    .poll(async () => {
      const values = await paints()
      return values.every(
        (value) => JSON.stringify(value) === JSON.stringify(values[0]),
      )
    })
    .toBe(true)
  const settled = await paints()
  expect(settled[0].image).toContain('linear-gradient')
}

test('appearance lives in the topbar and the avatar opens an in-place profile modal', async ({
  page,
  isMobile,
}, testInfo) => {
  await setup(page)
  await page.route('**/api/v1/users/me', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...user, ext_api_key: 'fixture-external-key' }),
    }),
  )
  await page.goto('/tags')
  await settled(page)
  const originalURL = page.url()
  const settings = page
    .locator('.workspace-header')
    .getByRole('button', { name: 'Внешний вид', exact: true })
  await expect(settings).toBeVisible()
  await expect(
    page
      .locator('.sidebar')
      .getByRole('button', { name: 'Внешний вид', exact: true }),
  ).toHaveCount(0)
  if (isMobile)
    await page
      .getByRole('button', { name: 'Открыть меню', exact: true })
      .click()
  const sidebar = page.locator(isMobile ? '.mobile-sidebar' : '.sidebar')
  if (!isMobile)
    await page.getByRole('button', { name: 'Развернуть сайдбар', exact: true }).click()
  await expect(
    sidebar.getByRole('button', { name: 'Внешний вид', exact: true }),
  ).toHaveCount(0)
  await expect(
    sidebar.getByRole('button', { name: 'Выйти', exact: true }),
  ).toHaveAttribute('data-variant', 'ghost')
  await sidebar.getByRole('button', { name: 'Профиль', exact: true }).click()
  const profile = page.getByRole('dialog', { name: 'Мой профиль', exact: true })
  await expect(profile).toBeVisible()
  await expect(profile.getByLabel('Имя', { exact: true })).toHaveValue(
    user.name,
  )
  await expect(profile.getByLabel('Логин', { exact: true })).toHaveValue(
    user.login,
  )
  await expect(
    profile.getByLabel('Внешний API-ключ', { exact: true }),
  ).toHaveValue('fixture-external-key')
  expect(page.url()).toBe(originalURL)
  await expect(profile).toHaveCSS('opacity', '1')
  await page.screenshot({
    path: testInfo.outputPath('profile.png'),
    animations: 'disabled',
  })
  await profile.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await expect(profile).toHaveCount(0)
  await settings.click()
  await expect(
    page.getByRole('dialog', { name: 'Внешний вид', exact: true }),
  ).toBeVisible()
})

test('reference theme colors and table control gradients stay consistent in both view modes', async ({
  page,
}, testInfo) => {
  await setup(page)
  await page.goto('/keys')
  await settled(page)
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(38, 39, 42)',
  )
  for (const theme of ['Тёмная', 'Светлая'] as const) {
    if (theme === 'Светлая') await appearance(page, theme)
    await sameControls(page)
    await page
      .getByRole('button', { name: 'Переключить режим таблицы', exact: true })
      .click()
    await sameControls(page)
    await page.getByRole('button', { name: 'Добавить', exact: true }).click()
    const dialog = page.getByRole('dialog')
    const input = dialog.getByLabel('Значение ключа', { exact: false })
    const owner = dialog.getByLabel('Владелец', { exact: true })
    if (theme === 'Светлая') {
      await expect(page.locator('body')).toHaveCSS(
        'background-color',
        'rgb(191, 195, 197)',
      )
      await expect(input).toHaveCSS('background-color', 'rgb(194, 200, 203)')
      await expect(owner).toHaveCSS('background-color', 'rgb(194, 200, 203)')
    }
    await expect(dialog).toHaveCSS('opacity', '1')
    await page.screenshot({
      path: testInfo.outputPath(
        theme === 'Тёмная' ? 'form-dark.png' : 'form-light.png',
      ),
      animations: 'disabled',
    })
    await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
  }
})

test('form inputs and selects share height and focus treatment while textarea starts at three lines', async ({
  page,
}) => {
  await setup(page)
  const dialog = await addForm(page, '/keys')
  const input = dialog.getByLabel('Значение ключа', { exact: false })
  const select = dialog.getByLabel('Владелец', { exact: true })
  await expect(input).toHaveCSS('height', '36px')
  await expect(select).toHaveCSS('height', '36px')
  await select.focus()
  await expect(input).not.toBeFocused()
  await expect
    .poll(() =>
      input.evaluate(
        (node) =>
          node
            .getAnimations()
            .filter((animation) => animation.playState === 'running').length,
      ),
    )
    .toBe(0)
  const normalBorder = await input.evaluate(
    (node) => getComputedStyle(node).borderColor,
  )
  await input.focus()
  await expect
    .poll(() =>
      input.evaluate(
        (node) =>
          node
            .getAnimations()
            .filter((animation) => animation.playState === 'running').length,
      ),
    )
    .toBe(0)
  const focusedBorder = await input.evaluate(
    (node) => getComputedStyle(node).borderColor,
  )
  expect(focusedBorder).not.toBe(normalBorder)
  await expect(input).toHaveCSS('outline-style', 'none')
  await select.focus()
  await expect(select).toHaveCSS('border-color', focusedBorder)
  await expect(select).toHaveCSS('outline-style', 'none')
  const textarea = dialog.getByLabel('Описание', { exact: true })
  await expect(textarea).toHaveAttribute('rows', '3')
  expect(
    await textarea.evaluate((node) => {
      const style = getComputedStyle(node)
      return (
        (node.clientHeight -
          parseFloat(style.paddingTop) -
          parseFloat(style.paddingBottom)) /
        parseFloat(style.lineHeight)
      )
    }),
  ).toBeCloseTo(3, 0)
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
  const account = await addForm(page, '/accounts')
  const number = account.getByLabel('Лимит отправки', { exact: false })
  await expect(number).toHaveCSS('height', '36px')
  await expect(number).toHaveCSS('appearance', 'textfield')
  await number.fill('7')
  await number.press('ArrowUp')
  await expect(number).toHaveValue('8')
})

test('pagination controls stay 32px without shrinking the existing footer', async ({
  page,
}) => {
  await setup(page)
  await page.goto('/tags')
  await settled(page)
  const footer = page.locator('.table-pagination')
  const controls = [
    footer.getByRole('combobox'),
    footer.getByRole('button', { name: 'Предыдущая страница', exact: true }),
    footer.getByRole('button', { name: 'Следующая страница', exact: true }),
  ]
  for (const control of controls)
    await expect(control).toHaveCSS('height', '32px')
  const coarse = await page.evaluate(
    () => matchMedia('(pointer: coarse)').matches,
  )
  const before = (await footer.boundingBox())!.height
  expect(before).toBeGreaterThanOrEqual(coarse ? 54 : 44)
  await page
    .getByRole('button', { name: 'Переключить режим таблицы', exact: true })
    .click()
  expect((await footer.boundingBox())!.height).toBe(before)
  const box = (await footer.boundingBox())!
  expect(box.y + box.height).toBeLessThanOrEqual(
    page.viewportSize()!.height + 1,
  )
})

test('generic forms retain original field groups, role selection, switches and separator order', async ({
  page,
  isMobile,
}, testInfo) => {
  const requests = await setup(page)
  const layouts = [
    { path: '/keys', order: ['value', 'user_id', 'description', 'sep1'] },
    {
      path: '/tags',
      order: [
        'name',
        'user_id',
        'api_keys',
        'color_txt',
        'color_bg',
        'description',
        'sep1',
      ],
    },
    { path: '/versions', order: ['file_name', 'sep2', 'description', 'sep3'] },
    {
      path: '/accounts',
      order: ['limit', 'cooldown', 'sep0', 'files', 'sep1'],
    },
  ]
  for (const layout of layouts) {
    const dialog = await addForm(page, layout.path)
    expect(await formOrder(dialog)).toEqual(layout.order)
    for (const separator of await dialog.locator('.form-divider').all()) {
      await expect(separator).toHaveAttribute('role', 'separator')
      await expect(separator).toHaveCSS('border-top-width', '1px')
      await expect(separator).toHaveCSS('border-bottom-width', '1px')
    }
    await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
  }
  const dialog = await addForm(page, '/users')
  expect(await formOrder(dialog)).toEqual([
    'name',
    'is_superuser',
    'permissions',
    'api_keys',
    'sep1',
    'login',
    'password',
    'sep2',
    'ext_api_key',
    'sep3',
    'is_active',
    'sep4',
  ])
  const role = dialog.getByLabel('Роль', { exact: true })
  await expect(role).toHaveValue('user')
  await role.selectOption('admin')
  const active = dialog.getByRole('switch', { name: 'Активен', exact: true })
  await expect(active).toHaveAttribute('aria-checked', 'true')
  await active.click()
  await expect(active).toHaveAttribute('aria-checked', 'false')
  const labelBox = (await dialog
    .locator('label[for="field-is_active"]')
    .boundingBox())!
  const switchBox = (await active.boundingBox())!
  expect(
    Math.abs(
      labelBox.y + labelBox.height / 2 - switchBox.y - switchBox.height / 2,
    ),
  ).toBeLessThan(2)
  if (!isMobile) {
    const name = (await dialog
      .getByLabel('Имя', { exact: true })
      .boundingBox())!
    const roleBox = (await role.boundingBox())!
    expect(Math.abs(name.y - roleBox.y)).toBeLessThan(2)
    expect(roleBox.x).toBeGreaterThan(name.x)
  }
  await page.screenshot({
    path: testInfo.outputPath('users-switches.png'),
    animations: 'disabled',
  })
  await dialog.getByRole('textbox', { name: 'Логин', exact: true }).fill('polish-user')
  await dialog.getByLabel('Пароль', { exact: true }).fill('fixture-password')
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect
    .poll(() =>
      requests.some(
        (request) => request.path === '/users/' && request.method === 'POST',
      ),
    )
    .toBe(true)
  const payload = requests.find(
    (request) => request.path === '/users/' && request.method === 'POST',
  )!.body
  expect(payload).toMatchObject({
    login: 'polish-user',
    is_active: false,
    is_superuser: true,
  })
  expect(Object.keys(payload).some((key) => key.startsWith('sep'))).toBe(false)
})

test('styled datetime calendar edits campaign UTC values and supports keyboard day selection', async ({
  page,
}, testInfo) => {
  const requests = await setup(page)
  await page.goto('/campaigns/101')
  await settled(page)
  await page
    .getByRole('button', { name: 'Все действия кампании', exact: true })
    .click()
  await page
    .getByRole('menuitem', { name: 'Настройки кампании', exact: true })
    .click()
  const form = page.locator('.modal-content').filter({ has: page.locator('#field-start_ts') })
  await expect(form).toBeVisible()
  const start = form.getByLabel('Начало (UTC)', { exact: true })
  await expect.poll(() => form.evaluate(node => node.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0)
  await start.fill('2026-08-15T10:30')
  for (const input of await form.locator('input[type="datetime-local"]').all()) {
    await expect(input).toHaveCSS('height', '36px')
    const box = (await input.boundingBox())!
    const parent = (await input.locator('..').boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(parent.x + parent.width + 1)
  }
  const trigger = start.locator('..').getByRole('button', { name: 'Открыть календарь', exact: true })
  await trigger.click()
  const picker = page.locator('.datetime-popover')
  await expect(picker).toBeVisible()
  await expect(picker).toHaveCSS('opacity', '1')
  const viewport = page.viewportSize()!
  const bounds = (await picker.boundingBox())!
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.y).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1)
  expect(await picker.evaluate((node) => node.scrollTop)).toBe(0)
  if (viewport.height >= 600) {
    expect(await picker.evaluate((node) => node.scrollHeight <= node.clientHeight + 1)).toBe(true)
  }
  await expect(picker.locator('[data-date="2026-08-15"]')).toBeFocused()
  if (viewport.width <= 767) {
    await expect(picker).toHaveClass(/datetime-mobile-dialog/)
    await page.locator('.datetime-mobile-overlay').click({ position: { x: 2, y: 2 } })
  } else {
    await page.keyboard.press('Escape')
  }
  await expect(picker).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(start).toHaveValue('2026-08-15T10:30')
  await trigger.click()
  await expect(picker.locator('[data-date="2026-08-15"]')).toBeFocused()
  await page.screenshot({
    path: testInfo.outputPath('datetime-picker.png'),
    animations: 'allow',
  })
  await picker.locator('[data-date="2026-08-17"]').click()
  await picker.getByLabel('Часы', { exact: true }).selectOption('06')
  await picker.getByLabel('Минуты', { exact: true }).selectOption('45')
  await expect(start).toHaveValue('2026-08-17T06:45')
  const day = picker.locator('[data-date="2026-08-17"]')
  await day.focus()
  await day.press('ArrowRight')
  const next = picker.locator('[data-date="2026-08-18"]')
  await expect(next).toBeFocused()
  await next.press('Enter')
  await expect(start).toHaveValue('2026-08-18T06:45')
  await picker.getByRole('button', { name: 'Готово', exact: true }).click()
  await expect(trigger).toBeFocused()
  await form.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect
    .poll(() =>
      requests.some(
        (request) =>
          request.path === '/campaigns/101' && request.method === 'PUT',
      ),
    )
    .toBe(true)
  const payload = requests.find(
    (request) => request.path === '/campaigns/101' && request.method === 'PUT',
  )!.body
  expect(payload.start_ts).toBe('2026-08-18T06:45:00')
  expect(payload.schedule).toEqual({
    1: [9, 10],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
    7: [],
  })
  expect(payload).not.toHaveProperty('data_text')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('datetime filters preserve the existing SQL UTC query format after calendar selection', async ({
  page,
}) => {
  const requests = await setup(page)
  await page.goto('/campaigns')
  await settled(page)
  await page.getByRole('button', { name: 'Фильтры', exact: true }).click()
  const dialog = page.getByRole('dialog', {
    name: 'Фильтры',
    exact: true,
  })
  await dialog.getByLabel('Колонка', { exact: true }).selectOption('create_ts')
  await dialog.getByLabel('Оператор', { exact: true }).selectOption('gte')
  const value = dialog.getByLabel('Значение фильтра', { exact: true })
  await value.fill('2026-08-15T10:30')
  await value
    .locator('..')
    .getByRole('button', { name: 'Открыть календарь', exact: true })
    .click()
  const picker = page.locator('.datetime-popover')
  await picker.locator('[data-date="2026-08-16"]').click()
  await picker.getByRole('button', { name: 'Готово', exact: true }).click()
  await dialog.getByRole('button', { name: 'Применить', exact: true }).click()
  await expect
    .poll(() =>
      requests.some(
        (request) =>
          new URLSearchParams(request.query).get('filters[0][field]') ===
          'create_ts',
      ),
    )
    .toBe(true)
  const request = requests.find(
    (request) =>
      new URLSearchParams(request.query).get('filters[0][field]') ===
      'create_ts',
  )!
  const query = new URLSearchParams(request.query)
  expect(query.get('filters[0][operator]')).toBe('gte')
  expect(query.get('filters[0][value]')).toBe('2026-08-16 10:30:00')
})
