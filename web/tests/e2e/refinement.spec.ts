import { test, expect } from '@playwright/test'
import { setup, row } from './fixtures'

test('profile and logout share one row and pointer clicks leave no external ring', async ({ page, isMobile }) => {
  await setup(page)
  await page.goto('/campaigns')
  await expect(page.locator('.table-loading-overlay')).toHaveCount(0)
  if (isMobile) {
    await page.getByRole('button', { name: 'Открыть меню', exact: true }).tap()
  } else {
    await expect(page.locator('.sidebar .sidebar-logout')).toHaveCount(0)
    await page.getByRole('button', { name: 'Развернуть сайдбар', exact: true }).click()
  }
  const sidebar = page.locator(isMobile ? '.mobile-sidebar' : '.sidebar')
  const profile = sidebar.getByRole('button', { name: 'Профиль', exact: true })
  const logout = sidebar.getByRole('button', { name: 'Выйти', exact: true })
  await expect(profile).toBeVisible()
  await expect(logout).toBeVisible()
  const a = (await profile.boundingBox())!, b = (await logout.boundingBox())!
  expect(Math.abs(a.y + a.height / 2 - b.y - b.height / 2)).toBeLessThan(2)
  await expect(logout).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  expect(await sidebar.locator('.user-avatar').evaluate(el => getComputedStyle(el).color)).toBe(
    await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent-ink').trim()).then(hex => {
      const values = [1, 3, 5].map(n => Number.parseInt(hex.slice(n, n + 2), 16))
      return `rgb(${values.join(', ')})`
    }),
  )
  if (isMobile) await sidebar.getByRole('button', { name: 'Закрыть меню', exact: true }).tap()
  const menu = page.getByRole('button', { name: 'Действия строки 101', exact: true })
  await menu.click()
  await page.keyboard.press('Escape')
  expect(await menu.evaluate(el => getComputedStyle(el).outlineWidth)).not.toBe('3px')
})

test('compact campaign names use available space without splitting a trailing digit', async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile)
  await setup(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/v1/campaigns/?*', route => route.fulfill({ json: {
    data: [{ ...row, name: '21437,21439,21441,21442', status: 1 }], total: 1,
  } }))
  await page.goto('/campaigns')
  const name = page.locator('.table-primary-value').first()
  await expect(name).toContainText('21437,21439,21441,21442')
  const lines = await name.evaluate(el => {
    const range = document.createRange()
    range.selectNode(el.firstChild!)
    return range.getClientRects().length
  })
  expect(lines).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('mobile-refined.png'), animations: 'disabled' })
})
