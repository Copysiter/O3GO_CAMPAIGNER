import { expect, test } from '@playwright/test'
import { setup } from './fixtures'

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} campaign dividers keep their relief and symmetric toggle spacing`, async ({ page }) => {
    await setup(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript((theme) => {
      localStorage.setItem('campaigner.preferences', JSON.stringify({ version: 2, theme }))
    }, theme)
    await page.goto('/campaigns')
    await page.getByRole('button', { name: 'Новая рассылка', exact: true }).click()
    const dialog = page.getByRole('dialog')
    const panel = dialog.getByRole('tabpanel')
    await expect(dialog.locator('#field-name')).toBeVisible()
    await expect(panel.locator(':scope > :visible').last()).not.toHaveAttribute('role', 'separator')
    await dialog.getByRole('tab', { name: /Сообщение/ }).click()
    const toggle = panel.locator('#field-unique_shorten_link')
    await expect(toggle).toBeVisible()
    await expect(panel.locator(':scope > :visible').last()).not.toHaveAttribute('role', 'separator')

    const result = await toggle.evaluate((control) => {
      const field = control.closest('.form-field')!.getBoundingClientRect()
      const body = control.closest('.modal-body')!
      const topLine = body.querySelector('[data-separator="sep10"]')!
      const bottomLine = body.querySelector('[data-separator="sep12"]')!
      const probe = document.createElement('span')
      probe.style.cssText = 'position:absolute;border-top:1px solid var(--border);border-bottom:1px solid var(--line-light)'
      topLine.append(probe)
      const edges = (node: Element) => {
        const style = getComputedStyle(node)
        return [style.borderTopColor, style.borderBottomColor, style.borderTopWidth, style.borderBottomWidth]
      }
      const expected = edges(probe)
      probe.remove()
      return {
        above: field.top - topLine.getBoundingClientRect().bottom,
        below: bottomLine.getBoundingClientRect().top - field.bottom,
        gutter: parseFloat(getComputedStyle(body).paddingLeft),
        edges: [edges(topLine), edges(bottomLine)],
        expected,
      }
    })
    expect(result.above).toBeCloseTo(result.gutter, 0)
    expect(result.below).toBeCloseTo(result.gutter, 0)
    expect(result.edges).toEqual([result.expected, result.expected])
  })
}

test('account edit has no final separator when the upload field is omitted', async ({ page }) => {
  await setup(page)
  await page.route('**/api/v1/android/accounts/**', (route) =>
    route.fulfill({ json: { data: [{ id: 51, file_name: 'account.tar.gz', limit: 10, cooldown: 10 }], total: 1 } }),
  )
  await page.goto('/accounts')
  await page.getByRole('button', { name: 'Действия строки 51' }).click()
  await page.getByRole('menuitem', { name: 'Редактировать', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('#field-cooldown')).toBeVisible()
  await expect(dialog.getByRole('separator')).toHaveCount(0)
})
