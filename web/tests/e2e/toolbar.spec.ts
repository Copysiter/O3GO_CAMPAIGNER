import { expect, test } from '@playwright/test'
import { setup } from './fixtures'

const toolbars = '.workspace-header, .page-toolbar, .campaign-actions, .table-controls, .table-selection, .table-pagination'

for (const path of ['/campaigns', '/tags', '/keys', '/users', '/android', '/versions', '/accounts', '/campaigns/101']) {
  test(`${path} uses the same border-box button size in every toolbar`, async ({ page }, testInfo) => {
    await setup(page)
    await page.goto(path)
    await expect(page.locator('.table-controls')).toBeVisible()
    await expect(page.locator('.table-loading-overlay')).toHaveCount(0)
    const firstRow = page.locator('.data-table tbody [role="checkbox"]').first()
    if (await firstRow.count()) await firstRow.click()
    const expected = await page.evaluate(() => matchMedia('(pointer: coarse)').matches ? 44 : 32)
    const controls = await page.locator(toolbars).locator('[data-size][data-variant], select.native-select').evaluateAll((nodes) =>
      nodes.flatMap((node) => {
        const box = node.getBoundingClientRect()
        if (!box.width || !box.height) return []
        return [{
          label: node.getAttribute('aria-label') || node.textContent,
          variant: node.getAttribute('data-variant'),
          icon: node.getAttribute('data-size')?.startsWith('icon'),
          height: box.height,
          width: box.width,
          boxSizing: getComputedStyle(node).boxSizing,
        }]
      }),
    )
    expect(controls.length).toBeGreaterThanOrEqual(8)
    for (const control of controls) {
      expect(control.boxSizing, control.label || '').toBe('border-box')
      expect(control.height, `${control.label} (${control.variant})`).toBe(expected)
      if (control.icon) expect(control.width, control.label || '').toBe(expected)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    if (path === '/campaigns' || path === '/campaigns/101') {
      await page.screenshot({ path: testInfo.outputPath('toolbars.png'), animations: 'disabled' })
    }
  })
}

test('campaign toolbar controls and the actual status badge match the table control height', async ({
  page,
}, testInfo) => {
  await setup(page)
  await page.goto('/campaigns/101')
  await expect(page.locator('.data-table tbody tr').first()).toBeVisible()
  await expect(page.locator('.table-loading-overlay')).toHaveCount(0)
  const expected = await page.evaluate(() => (matchMedia('(pointer: coarse)').matches ? 44 : 32))
  const refresh = page.locator('.table-controls > div:last-child > button:first-child')
  const reference = (await refresh.boundingBox())!
  expect(reference.height).toBe(expected)
  const controls = await page
    .locator(
      '.campaign-actions .campaign-toolbar-control, .campaign-toolbar-status > .status-badge',
    )
    .evaluateAll((nodes) =>
      nodes.flatMap((node) => {
        const box = node.getBoundingClientRect()
        if (!box.width || !box.height) return []
        return [
          {
            top: box.top,
            bottom: box.bottom,
            height: box.height,
            boxSizing: getComputedStyle(node).boxSizing,
          },
        ]
      }),
    )
  expect(controls.length).toBeGreaterThanOrEqual(4)
  for (const control of controls) {
    expect(control.boxSizing).toBe('border-box')
    expect(Math.abs(control.height - reference.height)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(control.top - controls[0].top)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(control.bottom - controls[0].bottom)).toBeLessThanOrEqual(0.5)
  }
  const back = (await page
    .locator('.campaign-actions a.campaign-toolbar-control[href="/campaigns"]')
    .boundingBox())!
  expect(back.width).toBe(expected)
  expect(back.height).toBe(expected)
  await page
    .locator('.campaign-actions')
    .screenshot({ path: testInfo.outputPath('campaign-toolbar.png'), animations: 'disabled' })
  await page
    .locator('.table-controls')
    .screenshot({ path: testInfo.outputPath('table-toolbar.png'), animations: 'disabled' })
  await page
    .locator('.workspace-header')
    .screenshot({ path: testInfo.outputPath('workspace-header.png'), animations: 'disabled' })
})

test('narrow filter rows keep value controls aligned to the property and operator widths', async ({
  page,
}, testInfo) => {
  await setup(page)
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/campaigns')
    await expect(page.locator('.data-table tbody tr').first()).toBeVisible()
    await expect(page.locator('.table-loading-overlay')).toHaveCount(0)
    await page.locator('.filter-add-button').click()
    const dialog = page.locator('.filter-dialog')
    await expect(dialog).toBeVisible()
    await dialog.evaluate(async (node) => {
      await Promise.all(node.getAnimations().map((animation) => animation.finished.catch(() => {})))
    })
    const fields = await dialog.locator('.filter-row').evaluate((row) =>
      ['.filter-row-property select', '.filter-row-operator select', '.filter-row-value input'].map(
        (selector) => {
          const box = row.querySelector(selector)!.getBoundingClientRect()
          return { left: box.left, width: box.width, right: box.right }
        },
      ),
    )
    for (const field of fields) {
      expect(Math.abs(field.left - fields[0].left)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(field.width - fields[0].width)).toBeLessThanOrEqual(0.5)
      expect(field.right).toBeLessThanOrEqual(width)
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1)
    await dialog
      .locator('.filter-dialog-rows')
      .screenshot({
        path: testInfo.outputPath(`filter-fields-${width}.png`),
        animations: 'disabled',
      })
  }
})
