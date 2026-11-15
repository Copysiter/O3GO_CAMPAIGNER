import { expect, test } from '@playwright/test'
import { setup } from './fixtures'
import { materialThemes, palette, type Color } from '../../src/lib/appearance'

const rgb = (hex: string) =>
  `rgb(${[1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)).join(', ')})`

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} accents stay consistent on controls, theme choices and branding`, async ({ page, isMobile }, testInfo) => {
    await setup(page)
    await page.goto('/campaigns')
    await expect(page.locator('.data-table tbody tr').first()).toBeVisible()
    await expect(page.locator('.table-loading-overlay')).toHaveCount(0)
    await page.getByRole('button', { name: 'Внешний вид', exact: true }).click()
    const dialog = page.getByRole('dialog')
    const choice = dialog.getByRole('button', { name: theme === 'light' ? 'Светлая' : 'Тёмная', exact: true })
    await choice.click()
    const statuses = await page.locator('.status-badge').evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).color),
    )
    const foreground = theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(23, 33, 40)'
    for (const color of Object.keys(palette) as Color[]) {
      const primary = rgb(palette[color][theme === 'light' ? 1 : 0])
      const swatch = dialog.locator(`[data-color="${color}"]`)
      await swatch.click()
      await expect(swatch).toHaveCSS('background-color', primary)
      await expect(swatch).toHaveCSS('color', foreground)
      await expect(swatch).toHaveCSS('border-top-color', foreground)
      await expect(choice).toHaveCSS('border-top-color', primary)
      await expect(choice.locator('.theme-check')).toHaveCSS('color', primary)
      await expect(choice).toHaveCSS('background-color', rgb(materialThemes[theme].colors.sidebar))
      await expect(choice.locator('.theme-mode-icon')).toHaveCSS('color', rgb(materialThemes[theme].colors.text))
      await expect(choice.locator('.theme-choice-title')).toHaveCSS('color', rgb(materialThemes[theme].colors.text))
      await expect(dialog.getByRole('button', { name: 'Готово', exact: true })).toHaveCSS('color', foreground)
      await expect(page.locator('.sidebar-brand svg')).toHaveCSS('color', primary)
      await expect(page.locator('.nav-active')).toHaveCSS('color', primary)
      await expect(page.locator('.user-avatar').first()).toHaveCSS('color', primary)
      await expect(page.locator('.table-controls [data-variant="default"]')).toHaveCSS('color', foreground)
      if (theme === 'light' && color === 'preset2') {
        await dialog.screenshot({ path: testInfo.outputPath('light-green-appearance.png'), animations: 'disabled' })
      }
    }
    await dialog.getByRole('button', { name: 'Готово', exact: true }).click()
    expect(await page.locator('.status-badge').evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).color),
    )).toEqual(statuses)
    const primary = rgb(palette.preset4[theme === 'light' ? 1 : 0])
    if (await page.evaluate(() => matchMedia('(hover: hover)').matches)) {
      await page.locator('.table-primary-value').first().hover()
      await expect(page.locator('.table-primary-value').first()).toHaveCSS('color', primary)
      await page.locator('.nav-active').hover()
      await expect(page.locator('.nav-active')).toHaveCSS('color', primary)
    }
    await page.locator('.data-table tbody [role="checkbox"]').first().click()
    await expect(page.locator('.data-table tbody [role="checkbox"]').first()).toHaveCSS('background-color', primary)
    await expect(page.locator('.data-table tbody [role="checkbox"]').first()).toHaveCSS('color', foreground)
    await page.reload()
    await expect(page.locator('.table-controls [data-variant="default"]')).toHaveCSS('color', foreground)
    // WebKit can retain stale computed styles inside display:none subtrees.
    // Verify the visible mobile navigation, not the hidden desktop sidebar.
    if (isMobile) await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
    const sidebar = page.locator(isMobile ? '.mobile-sidebar' : '.sidebar')
    await expect(sidebar.locator('.sidebar-brand svg')).toBeVisible()
    await expect(sidebar.locator('.sidebar-brand svg')).toHaveCSS('color', primary)
    await expect(sidebar.locator('.nav-active')).toHaveCSS('color', primary)
    await expect(sidebar.locator('.user-avatar')).toHaveCSS('color', primary)
  })
}
