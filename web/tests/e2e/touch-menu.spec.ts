import { test, expect } from '@playwright/test'
test('long press opens context menu without accidentally executing an action', async ({
  page,
  isMobile,
  browserName,
}) => {
  test.skip(!isMobile || browserName !== 'chromium', 'Requires Chromium CDP touch input')
  const user = { id: 1, name: 'Test', is_superuser: true, is_active: true, permissions: [] }
  const mutations: string[] = []
  await page.addInitScript(
    (u) =>
      localStorage.setItem(
        'campaigner.workspace.session',
        JSON.stringify({ access_token: 'test', token_type: 'bearer', user: u }),
      ),
    user,
  )
  await page.route('**/api/v1/**', (route) => {
    const request = route.request()
    if (request.method() !== 'GET' && !request.url().includes('/auth/'))
      mutations.push(request.url())
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        route.request().url().includes('test-token')
          ? { user }
          : { data: [{ id: 1, name: 'Touch campaign', status: 0 }], total: 1 },
      ),
    })
  })
  await page.goto('/campaigns')
  const cell = page.locator('.data-table tbody tr').first().locator('td').nth(2)
  await cell.scrollIntoViewIfNeeded()
  const rect = await cell.boundingBox()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: rect!.x + rect!.width / 2, y: rect!.y + rect!.height / 2 }],
  })
  await page.waitForTimeout(850)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(page.getByRole('menuitem', { name: 'Все поля и подробности' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(mutations).toEqual([])
  await page.getByRole('menuitem', { name: 'Все поля и подробности' }).tap()
  await expect(page.getByRole('dialog')).toContainText('Touch campaign')
  expect(mutations).toEqual([])
})
