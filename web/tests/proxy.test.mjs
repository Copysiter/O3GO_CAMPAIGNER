import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { access } from 'node:fs/promises'
import http from 'node:http'
import { dirname, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const webDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const reportBytes = Buffer.from([
  0x50, 0x4b, 0x03, 0x04, 0, 0xff, 0x80, 13, 10, 0x42,
])

async function listen(server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return `http://127.0.0.1:${server.address().port}`
}

async function closeServer(server) {
  if (!server.listening) return
  server.closeAllConnections()
  await new Promise((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  )
}

async function availablePort() {
  const reservation = http.createServer()
  await listen(reservation)
  const port = reservation.address().port
  await closeServer(reservation)
  return port
}

// This deliberately uses the production Next HTTP server and a real upstream socket.
// Route mocks would hide Next's URL normalization, multipart, and response-header bugs.
test(
  'production API proxy preserves the existing FastAPI transport contract',
  { timeout: 60_000 },
  async (t) => {
    await access(resolve(webDirectory, '.next/BUILD_ID')).catch(() => {
      throw new Error('Run npm run build in web before npm run test:proxy')
    })
    let upstreamOrigin = ''
    const upstream = http.createServer(async (request, response) => {
      try {
        const chunks = []
        for await (const chunk of request) chunks.push(chunk)
        const body = Buffer.concat(chunks)
        const path = new URL(request.url, upstreamOrigin).pathname
        if (path === '/api/v1/campaigns/9/report') {
          response.writeHead(200, {
            'Content-Type':
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="campaign-9.xlsx"',
            'Content-Length': String(reportBytes.length),
          })
          response.end(reportBytes)
          return
        }
        if (path === '/api/v1/redirect') {
          response.writeHead(307, {
            Location: `${upstreamOrigin}/api/v1/campaigns/?limit=5`,
          })
          response.end()
          return
        }
        if (path === '/api/v1/error') {
          response.writeHead(422, { 'Content-Type': 'application/json' })
          response.end(
            JSON.stringify({
              detail: [{ loc: ['body', 'name'], msg: 'Field required' }],
            }),
          )
          return
        }
        const headers = { 'Content-Type': 'application/json' }
        if (path === '/api/v1/auth/access-token') {
          headers['Set-Cookie'] = [
            'refresh-token=fixture-refresh; HttpOnly; SameSite=Lax; Path=/api/v1/auth/',
            'transport-fixture=present; SameSite=Lax; Path=/',
          ]
        }
        response.writeHead(200, headers)
        response.end(
          JSON.stringify({
            method: request.method,
            url: request.url,
            authorization: request.headers.authorization,
            cookie: request.headers.cookie,
            accept: request.headers.accept,
            contentType: request.headers['content-type'],
            body: body.toString('base64'),
          }),
        )
      } catch (error) {
        response.writeHead(500, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ detail: error.message }))
      }
    })
    t.after(() => closeServer(upstream))
    upstreamOrigin = await listen(upstream)
    const nextPort = await availablePort()
    const nextOrigin = `http://127.0.0.1:${nextPort}`
    let logs = '',
      startError
    const next = spawn(
      process.execPath,
      [
        resolve(webDirectory, 'node_modules/next/dist/bin/next'),
        'start',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(nextPort),
      ],
      {
        cwd: webDirectory,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          API_ORIGIN: upstreamOrigin,
          NEXT_PUBLIC_API_ORIGIN: '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    const capture = (chunk) => {
      logs = (logs + chunk.toString()).slice(-12_000)
    }
    next.stdout.on('data', capture)
    next.stderr.on('data', capture)
    next.on('error', (error) => {
      startError = error
    })
    t.after(async () => {
      if (next.exitCode !== null || next.signalCode !== null) return
      const exited = new Promise((resolveExit) =>
        next.once('exit', resolveExit),
      )
      next.kill('SIGTERM')
      let timer
      await Promise.race([
        exited,
        new Promise((resolveTimeout) => {
          timer = setTimeout(resolveTimeout, 3000)
        }),
      ])
      clearTimeout(timer)
      if (next.exitCode === null && next.signalCode === null) {
        next.kill('SIGKILL')
        await exited
      }
    })
    const fetchNext = (path, options = {}) =>
      fetch(`${nextOrigin}${path}`, {
        ...options,
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      })
    const deadline = Date.now() + 30_000
    let ready = false
    while (Date.now() < deadline) {
      if (startError) throw startError
      if (next.exitCode !== null)
        throw new Error(
          `Next exited before readiness (${next.exitCode}):\n${logs}`,
        )
      try {
        const response = await fetchNext('/api/v1/probe/')
        const payload = await response.json()
        if (response.status === 200 && payload.url === '/api/v1/probe/') {
          ready = true
          break
        }
      } catch {}
      await delay(150)
    }
    assert.ok(
      ready,
      `Next proxy did not become ready; rebuild after changing the route handler.\n${logs}`,
    )

    await t.test(
      'GET preserves trailing slash, query encoding, authorization and cookies',
      async () => {
        const query =
          'filters%5B0%5D%5Bfield%5D=name&filters%5B0%5D%5Boperator%5D=contains&filters%5B0%5D%5Bvalue%5D=hello%2Bworld&limit=20'
        const response = await fetchNext(`/api/v1/campaigns/?${query}`, {
          headers: {
            Authorization: 'Bearer fixture-access',
            Cookie: 'fixture-session=abc',
            Accept: 'application/json',
          },
        })
        assert.equal(
          response.status,
          200,
          'Next must not redirect away the API trailing slash',
        )
        const payload = await response.json()
        assert.equal(payload.method, 'GET')
        assert.equal(payload.url, `/api/v1/campaigns/?${query}`)
        assert.equal(payload.authorization, 'Bearer fixture-access')
        assert.equal(payload.cookie, 'fixture-session=abc')
        assert.equal(payload.accept, 'application/json')
      },
    )

    await t.test(
      'login forwards form encoding and both Set-Cookie headers',
      async () => {
        const form = new URLSearchParams({
          username: 'fixture+user',
          password: 'p&= space',
        })
        const response = await fetchNext('/api/v1/auth/access-token', {
          method: 'POST',
          body: form,
        })
        assert.equal(response.status, 200)
        const payload = await response.json()
        assert.equal(payload.method, 'POST')
        assert.match(
          payload.contentType,
          /^application\/x-www-form-urlencoded/i,
        )
        assert.equal(
          Buffer.from(payload.body, 'base64').toString(),
          form.toString(),
        )
        const cookies = response.headers.getSetCookie()
        assert.equal(cookies.length, 2)
        assert.ok(
          cookies.some(
            (cookie) =>
              cookie.includes('refresh-token=fixture-refresh') &&
              cookie.includes('HttpOnly'),
          ),
        )
        assert.ok(
          cookies.some((cookie) =>
            cookie.includes('transport-fixture=present'),
          ),
        )
      },
    )

    await t.test(
      'multipart upload preserves boundary, filename and raw file bytes',
      async () => {
        const fileBytes = Buffer.from(
          'phone;name\r\n79990000000;Имя\r\n\u0000\u00ff',
          'utf8',
        )
        const form = new FormData()
        form.append(
          'file',
          new Blob([fileBytes], { type: 'text/csv' }),
          'contacts.csv',
        )
        const response = await fetchNext('/api/v1/upload/', {
          method: 'POST',
          body: form,
        })
        assert.equal(response.status, 200)
        const payload = await response.json()
        assert.equal(payload.method, 'POST')
        assert.equal(payload.url, '/api/v1/upload/')
        const boundary = payload.contentType.match(/boundary=([^;]+)/)?.[1]
        assert.ok(
          boundary,
          'multipart Content-Type must keep its original boundary',
        )
        const body = Buffer.from(payload.body, 'base64')
        assert.ok(body.includes(Buffer.from(`--${boundary}`)))
        assert.ok(
          body.includes(Buffer.from('name="file"; filename="contacts.csv"')),
        )
        assert.ok(
          body.includes(fileBytes),
          'upload data must reach FastAPI byte-for-byte',
        )
      },
    )

    await t.test('DELETE preserves the JSON selection body', async () => {
      const ids = { ids: [19, 42] }
      const response = await fetchNext('/api/v1/campaigns/9/campaign_dst', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids),
      })
      assert.equal(response.status, 200)
      const payload = await response.json()
      assert.equal(payload.method, 'DELETE')
      assert.equal(payload.contentType, 'application/json')
      assert.deepEqual(
        JSON.parse(Buffer.from(payload.body, 'base64').toString()),
        ids,
      )
    })

    await t.test(
      'Excel download keeps binary bytes and filename headers',
      async () => {
        const response = await fetchNext('/api/v1/campaigns/9/report')
        assert.equal(response.status, 200)
        assert.equal(
          response.headers.get('content-disposition'),
          'attachment; filename="campaign-9.xlsx"',
        )
        assert.equal(
          response.headers.get('content-type'),
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), reportBytes)
      },
    )

    await t.test(
      'upstream redirect remains on the frontend origin',
      async () => {
        const response = await fetchNext('/api/v1/redirect')
        assert.equal(response.status, 307)
        const location = response.headers.get('location')
        assert.ok(location)
        const destination = new URL(location, nextOrigin)
        assert.equal(destination.origin, nextOrigin)
        assert.equal(destination.pathname, '/api/v1/campaigns/')
        assert.equal(destination.search, '?limit=5')
        await response.arrayBuffer()
      },
    )

    await t.test(
      'upstream validation errors preserve their status and JSON detail',
      async () => {
        const response = await fetchNext('/api/v1/error')
        assert.equal(response.status, 422)
        assert.deepEqual(await response.json(), {
          detail: [{ loc: ['body', 'name'], msg: 'Field required' }],
        })
      },
    )

    await t.test('offline upstream returns a JSON 502', async () => {
      await closeServer(upstream)
      const response = await fetchNext('/api/v1/campaigns/')
      assert.equal(response.status, 502)
      assert.match(response.headers.get('content-type'), /application\/json/)
      const payload = await response.json()
      assert.equal(typeof payload.detail, 'string')
      assert.ok(payload.detail.length > 0)
    })
  },
)
