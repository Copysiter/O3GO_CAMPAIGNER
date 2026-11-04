import { test, expect } from '@playwright/test'
import { user } from './fixtures'

test('login sends OAuth form data, reports a failed attempt and persists the valid session', async ({
  page,
}) => {
  const attempts: {
    method: string
    body: URLSearchParams
    contentType: string
    authorization?: string
  }[] = []
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    if (path === '/auth/access-token') {
      attempts.push({
        method: request.method(),
        body: new URLSearchParams(request.postData() || ''),
        contentType: request.headers()['content-type'],
        authorization: request.headers().authorization,
      })
      await route.fulfill({
        status: attempts.length === 1 ? 400 : 200,
        contentType: 'application/json',
        body: JSON.stringify(
          attempts.length === 1
            ? { detail: 'Incorrect login or password' }
            : {
                access_token: 'valid-fixture',
                token_type: 'bearer',
                user,
                ts: '2026-11-02 12:00:00',
              },
        ),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        path === '/auth/test-token' ? { user, ts: '2026-11-02 12:00:00' } : { data: [], total: 0 },
      ),
    })
  })
  await page.goto('/campaigns')
  await expect(page.getByRole('heading', { name: 'С возвращением', exact: true })).toBeVisible()
  await page.getByLabel('Логин', { exact: true }).fill('alex+team')
  await page.getByLabel('Пароль', { exact: true }).fill('wrong & password=1')
  await page.getByRole('button', { name: 'Войти в рабочее пространство', exact: true }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Incorrect login or password' }),
  ).toContainText('Incorrect login or password')
  expect(await page.evaluate(() => localStorage.getItem('campaigner.workspace.session'))).toBeNull()
  expect(attempts[0].method).toBe('POST')
  expect(attempts[0].contentType).toContain('application/x-www-form-urlencoded')
  expect(attempts[0].body.get('username')).toBe('alex+team')
  expect(attempts[0].body.get('password')).toBe('wrong & password=1')
  expect(attempts[0].authorization).toBeUndefined()

  await page.getByLabel('Пароль', { exact: true }).fill('correct & password=2')
  await page.getByRole('button', { name: 'Войти в рабочее пространство', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Кампании', exact: true })).toBeVisible()
  expect(attempts[1].body.get('password')).toBe('correct & password=2')
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('campaigner.workspace.session')!).access_token,
    ),
  ).toBe('valid-fixture')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Кампании', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'С возвращением', exact: true })).toHaveCount(0)
})

test('expired JWT credentials clear the session', async ({ page }) => {
  await page.addInitScript(
    (u) =>
      localStorage.setItem(
        'campaigner.workspace.session',
        JSON.stringify({ access_token: 'expired-fixture', token_type: 'bearer', user: u }),
      ),
    user,
  )
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    await route.fulfill({
      status: path.endsWith('/auth/test-token') ? 403 : 200,
      contentType: 'application/json',
      body: JSON.stringify(
        path.endsWith('/auth/test-token')
          ? { detail: 'Could not validate credentials' }
          : { data: [], total: 0 },
      ),
    })
  })
  await page.goto('/campaigns')
  await expect(page.getByRole('heading', { name: 'С возвращением', exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('campaigner.workspace.session'))).toBeNull()
})

test('resource-level forbidden responses preserve an otherwise valid login', async ({ page }) => {
  await page.addInitScript(
    (u) =>
      localStorage.setItem(
        'campaigner.workspace.session',
        JSON.stringify({ access_token: 'valid-fixture', token_type: 'bearer', user: u }),
      ),
    user,
  )
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    await route.fulfill({
      status: path.endsWith('/auth/test-token') ? 200 : 403,
      contentType: 'application/json',
      body: JSON.stringify(
        path.endsWith('/auth/test-token')
          ? { user, ts: '2026-11-02 12:00:00' }
          : { detail: 'Permission denied for this resource' },
      ),
    })
  })
  await page.goto('/campaigns')
  await expect(
    page.getByRole('alert').filter({ hasText: 'Permission denied for this resource' }),
  ).toContainText('Permission denied for this resource')
  await expect(page.getByRole('heading', { name: 'Кампании', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'С возвращением', exact: true })).toHaveCount(0)
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('campaigner.workspace.session')!).access_token,
    ),
  ).toBe('valid-fixture')
})
