import type { Page } from '@playwright/test'

export const user = {
  id: 1,
  name: 'Test Admin',
  login: 'test',
  is_superuser: true,
  is_active: true,
  permissions: [
    'campaign.read',
    'campaign.manage',
    'campaign.start_stop',
    'campaign.openrouter.model',
    'campaign.auto_shorten_links',
  ],
}
export const row = {
  id: 101,
  name: 'Тестовая кампания с достаточно длинным названием',
  status: 0,
  user_id: 1,
  user,
  msg_total: 123,
  msg_delivered: 70,
  msg_sent: 90,
  msg_failed: 3,
  msg_undelivered: 5,
  ban_count: 0,
  link_clicks: 2,
  follow_count: 1,
  fake_clicks: 0,
  api_keys: ['test-key'],
  androids: ['device-1'],
  android_names: ['Test phone'],
  tags: [{ id: 2, name: 'VIP' }],
  msg_template: 'Привет, {field_1}',
  msg_attempts: 1,
  order: 1,
  msg_sending_timeout: 3600,
  msg_status_timeout: 86400,
  follow_limit: 0,
  create_ts: '2026-01-01T12:00:00',
  schedule: { 1: [9, 10] },
}
export async function setup(page: Page, admin = true) {
  const u = { ...user, is_superuser: admin }
  const requests: { method: string; path: string; query: string; body: any }[] = []
  await page.addInitScript((u) => {
    localStorage.setItem(
      'campaigner.workspace.session',
      JSON.stringify({
        access_token: 'test-only',
        token_type: 'bearer',
        user: u,
        ts: '2026-01-01T00:00:00',
      }),
    )
  }, u)
  await page.route('**/api/v1/**', async (route) => {
    const r = route.request(),
      url = new URL(r.url()),
      path = url.pathname.replace('/api/v1', '')
    let body: any
    try {
      body = r.postDataJSON()
    } catch {
      body = r.postData()
    }
    requests.push({ method: r.method(), path, query: url.search, body })
    let response: any = {}
    if (path === '/auth/test-token') response = { user: u, ts: '2026-01-01T00:00:00' }
    else if (path === '/auth/access-token')
      response = {
        access_token: 'test-only',
        token_type: 'bearer',
        user: u,
        ts: '2026-01-01T00:00:00',
      }
    else if (path === '/upload/')
      response = {
        filename: 'contacts-fixture.csv',
        fields: ['79990000000', 'Иван', 'https://example.com'],
      }
    else if (path.endsWith('/upload'))
      response = { file_name: String(body).match(/filename="([^"]+)"/)?.[1] || 'fixture-file.apk' }
    else if (path.startsWith('/options/'))
      response = path.includes('user')
        ? [{ text: 'Test Admin', value: 1 }]
        : path.includes('tag')
          ? [
              { text: 'VIP', value: 2 },
              { text: 'New', value: 3 },
            ]
          : path.includes('android')
            ? [{ text: 'Test phone', value: 'device-1' }]
            : path.includes('api_key')
              ? [{ text: 'test-key', value: 'test-key' }]
              : []
    else if (path === '/campaigns/101/campaign_dst')
      response =
        r.method() === 'GET'
          ? {
              data: [
                {
                  id: 501,
                  campaign_id: 101,
                  dst_addr: '79990000000',
                  status: 2,
                  text: 'A long test message '.repeat(20),
                  field_1: 'Имя',
                  clicked_link: true,
                },
              ],
              total: 1,
            }
          : row
    else if (path === '/campaigns/101') response = row
    else if (path === '/campaigns/' && r.method() === 'GET')
      response = { data: [row, { ...row, id: 102, name: 'Вторая кампания', status: 1 }], total: 2 }
    else if (path === '/campaigns/' && r.method() === 'POST')
      response = { ...row, ...body, id: 103 }
    else if (path === '/android/accounts/' && r.method() === 'POST')
      response = { count: body.files.length }
    else if (path === '/tags/')
      response =
        r.method() === 'GET'
          ? {
              data: [{ id: 2, name: 'VIP', description: 'Описание', user, api_keys: ['test-key'] }],
              total: 1,
            }
          : { id: 3, ...body }
    else if (r.method() === 'GET' && path.endsWith('/')) response = { data: [], total: 0 }
    else response = { ...row, ...body }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    })
  })
  return requests
}
