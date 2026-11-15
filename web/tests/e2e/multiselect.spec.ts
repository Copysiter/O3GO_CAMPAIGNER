import { expect, test } from '@playwright/test'
import { setup } from './fixtures'

test('campaign multiselect supports keyboard selection, scrolling, and repeated opening', async ({ page, isMobile, browserName }) => {
  await setup(page)
  const keys = Array.from({ length: 80 }, (_, i) => ({
    value: `key-${i + 1}`,
    text: `Ключ ${i + 1}`,
  }))
  await page.route('**/api/v1/options/api_key', route => route.fulfill({ json: keys }))
  await page.goto('/campaigns')
  await page.getByRole('button', { name: 'Новая рассылка', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Новая рассылка', exact: true })
  const trigger = form.getByRole('button', { name: 'API-ключи', exact: true })
  const popup = page.getByRole('dialog', { name: 'API-ключи', exact: true })
  const search = popup.getByRole('textbox')

  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await form.locator('#field-webhook_url').focus()
  await page.keyboard.press('Tab')
  await expect(search).toBeFocused()
  await expect.poll(() => popup.evaluate(element => {
    const box = element.getBoundingClientRect()
    return box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1
  })).toBe(true)
  const list = popup.getByRole('group', { name: 'API-ключи', exact: true })
  const last = popup.getByRole('checkbox', { name: 'Ключ 80', exact: true })
  const body = form.locator('.modal-body')
  const bodyScroll = await body.evaluate(node => node.scrollTop)
  if (!isMobile) {
    await list.hover()
    await page.mouse.wheel(0, 420)
  } else if (browserName === 'chromium') {
    const box = (await list.boundingBox())!
    const client = await page.context().newCDPSession(page)
    const x = box.x + box.width / 2
    const y = box.y + box.height * 0.85
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    for (let step = 1; step <= 6; step++) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x, y: y - step * box.height / 9 }],
      })
      await page.evaluate(() => new Promise(requestAnimationFrame))
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await client.detach()
  } else {
    await last.scrollIntoViewIfNeeded()
  }
  await expect.poll(() => list.evaluate(node => node.scrollTop)).toBeGreaterThan(0)
  expect(await body.evaluate(node => node.scrollTop)).toBe(bodyScroll)

  await search.fill('Ключ 80')
  await search.press('ArrowDown')
  await expect(last).toBeFocused()
  await page.keyboard.press('Space')
  await expect(last).toBeChecked()
  await expect(trigger).toHaveText('Выбрано: 1')
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await expect(popup).toBeHidden()
  await page.keyboard.press('Enter')
  await expect(search).toBeVisible()
  await expect(last).toBeChecked()
  await trigger.click()
  await expect(popup).toBeHidden()
  await trigger.click()
  await expect(popup).toBeVisible()
  await form.getByRole('heading', { name: 'Новая рассылка', exact: true }).click()
  await expect(popup).toBeHidden()
  await expect(form).toBeVisible()
})

test('resource multiselect can create a missing key and save it alongside an existing key', async ({ page }) => {
  const requests = await setup(page)
  await page.goto('/tags')
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  const form = page.getByRole('dialog', { name: /Создать/ })
  await form.locator('#field-name').fill('Тестовый тег')
  const trigger = form.getByRole('button', { name: 'API-ключи', exact: true })
  await trigger.click()
  const popup = page.getByRole('dialog', { name: 'API-ключи', exact: true })
  await popup.getByRole('checkbox', { name: 'test-key', exact: true }).check()
  const search = popup.getByRole('textbox')
  await search.fill('extra-key')
  await popup.getByRole('button', { name: 'Создать ключ «extra-key»', exact: true }).click()
  await expect(trigger).toHaveText('Выбрано: 2')
  await expect(popup).toBeVisible()
  await trigger.click()
  await form.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect.poll(() => requests.find(r => r.method === 'POST' && r.path === '/tags/')?.body.api_keys)
    .toEqual(['test-key', 'extra-key'])
})
