import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtempDisposable } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { Duplex } from 'node:stream'

import { expect } from '@playwright/test'

import { liveCloudBillingFixture } from '@e2e/fixtures/liveCloudBillingFixture'
import { liveCloudBillingConfigSchema } from '@e2e/fixtures/utils/liveCloudBillingConfig'

const test = liveCloudBillingFixture.extend<{
  sandboxProxy: { server: string; requests: string[] }
}>({
  sandboxProxy: async ({ liveCloudBillingConfig }, use) => {
    if (!liveCloudBillingConfig) throw new Error('Live routing config required')
    await using directory = await mkdtempDisposable(
      join(tmpdir(), 'comfy-sandbox-')
    )
    const key = join(directory.path, 'localhost-key.pem')
    const cert = join(directory.path, 'localhost-cert.pem')
    await promisify(execFile)(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'ec',
        '-pkeyopt',
        'ec_paramgen_curve:P-256',
        '-nodes',
        '-keyout',
        key,
        '-out',
        cert,
        '-days',
        '1',
        '-subj',
        '/CN=localhost'
      ],
      { timeout: 10_000 }
    )
    const requests: string[] = []
    const sockets = new Set<Duplex>()
    const sandbox = createHttpsServer(
      {
        key: readFileSync(key),
        cert: readFileSync(cert)
      },
      (request, response) => {
        const destination = `${request.method} https://${request.headers.host}${request.url}`
        requests.push(destination)
        response.setHeader(
          'Access-Control-Allow-Origin',
          liveCloudBillingConfig.PLAYWRIGHT_TEST_URL
        )
        response.end(destination)
      }
    )
    const proxy = createServer()
    proxy.on('connect', (_request, socket) => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      sandbox.emit('connection', socket)
    })
    proxy.on('connection', (socket) => {
      sockets.add(socket)
      socket.once('close', () => sockets.delete(socket))
    })
    await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve))
    const address = proxy.address()
    if (!address || typeof address === 'string')
      throw new Error('TCP address required')
    try {
      await use({ server: `http://127.0.0.1:${address.port}`, requests })
    } finally {
      sockets.forEach((socket) => socket.destroy())
      await new Promise<void>((resolve) => proxy.close(() => resolve()))
    }
  },
  proxy: async ({ sandboxProxy }, use) => {
    await use({ server: sandboxProxy.server })
  },
  ignoreHTTPSErrors: true,
  liveCloudBillingConfig: liveCloudBillingConfigSchema.parse({
    PLAYWRIGHT_TEST_URL: 'http://localhost:5173',
    PLAYWRIGHT_SETUP_API_URL: 'https://testcloud.comfy.org',
    CLOUD_ACCOUNT_EMAIL: 'routing@example.com',
    CLOUD_ACCOUNT_PASSWORD: 'unused'
  })
})

test.describe('Live Cloud network boundary', { tag: '@smoke' }, () => {
  test('rewrites browser auth to Cloud and provisions customers at the Comfy API', async ({
    page,
    sandboxProxy
  }) => {
    await page.route('http://localhost:5173/', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<html></html>' })
    )
    await page.goto('http://localhost:5173/')
    expect(
      await page.evaluate(() =>
        fetch('/api/auth/token', { method: 'POST' }).then((response) =>
          response.text()
        )
      )
    ).toBe('POST https://testcloud.comfy.org/api/auth/token')
    expect(
      await page.evaluate(() =>
        fetch('https://testapi.comfy.org/customers', { method: 'POST' }).then(
          (response) => response.text()
        )
      )
    ).toBe('POST https://testapi.comfy.org/customers')
    expect(sandboxProxy.requests).toEqual([
      'POST https://testcloud.comfy.org/api/auth/token',
      'POST https://testapi.comfy.org/customers'
    ])
  })

  for (const path of ['/api/billing/subscribe', '/customers']) {
    test(`blocks POST ${path} and fails even when the app catches it`, async ({
      page,
      networkPolicy
    }) => {
      await page.route('http://localhost:5173/', (route) =>
        route.fulfill({ contentType: 'text/html', body: '<html></html>' })
      )
      await page.goto('http://localhost:5173/')
      expect(
        await page.evaluate(
          (path) =>
            fetch(path, { method: 'POST' }).then(
              () => 'sent',
              () => 'blocked'
            ),
          path
        )
      ).toBe('blocked')
      expect([...networkPolicy.unexpected]).toEqual([
        `Mutation POST http://localhost:5173${path}`
      ])
      test.fail(true, 'The recorded mutation must fail fixture teardown')
    })
  }

  for (const client of ['request', 'context.request'] as const) {
    test(`${client} retains the API origin and mutation guards`, async ({
      request,
      context,
      networkPolicy,
      sandboxProxy
    }) => {
      const api = client === 'request' ? request : context.request
      const customer = await api.post('https://testapi.comfy.org/customers')
      expect(await customer.text()).toBe(
        'POST https://testapi.comfy.org/customers'
      )
      const auth = await api.post(
        'https://testcloud.comfy.org/api/auth/session'
      )
      expect(await auth.text()).toBe(
        'POST https://testcloud.comfy.org/api/auth/session'
      )
      await expect(
        api.post('https://testcloud.comfy.org/customers')
      ).rejects.toThrow('Forbidden live Cloud request')
      await expect(
        api.post('https://testapi.comfy.org/api/auth/token')
      ).rejects.toThrow('Forbidden live Cloud request')
      await expect(api.get('https://external.invalid/api')).rejects.toThrow(
        'Unexpected external request'
      )
      await expect(
        api.post('https://testcloud.comfy.org/internal/reset')
      ).rejects.toThrow('Forbidden live Cloud request')
      await expect(
        api.post('http://localhost:5173/api/auth/token')
      ).rejects.toThrow('Forbidden live Cloud request')
      expect(sandboxProxy.requests).toEqual([
        'POST https://testapi.comfy.org/customers',
        'POST https://testcloud.comfy.org/api/auth/session'
      ])
      expect([...networkPolicy.unexpected]).toEqual([
        'Mutation POST https://testcloud.comfy.org/customers',
        'Mutation POST https://testapi.comfy.org/api/auth/token',
        'API https://external.invalid/api',
        'Mutation POST https://testcloud.comfy.org/internal/reset',
        'Mutation POST http://localhost:5173/api/auth/token'
      ])
      test.fail(true, 'The recorded API violations must fail fixture teardown')
    })
  }

  test('retains the external WebSocket guard', async ({
    page,
    networkPolicy
  }) => {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const socket = new WebSocket('wss://external.invalid/socket')
          socket.onclose = () => resolve()
        })
    )
    expect([...networkPolicy.unexpected]).toEqual([
      'WebSocket wss://external.invalid/socket'
    ])
    test.fail(true, 'The recorded WebSocket must fail fixture teardown')
  })
})
