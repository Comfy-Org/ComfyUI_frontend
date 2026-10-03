import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtempDisposable } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { Duplex } from 'node:stream'

import {
  expect,
  liveCloudDisposableBillingFixture
} from '@e2e/fixtures/liveCloudDisposableBillingFixture'
import { LiveCloudOnboarding } from '@e2e/fixtures/components/LiveCloudOnboarding'
import { OnboardingCoachmarks } from '@e2e/fixtures/components/Tour'
import { liveCloudBillingConfigSchema } from '@e2e/fixtures/utils/liveCloudBillingConfig'

const test = liveCloudDisposableBillingFixture.extend<{
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
  for (const testId of ['coach-landing', 'coach-card']) {
    test(`dismisses late ${testId} across navigation without closing billing`, async ({
      page
    }) => {
      await page.route('http://localhost:5173/', (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: `
            <button onclick="document.getElementById('tutorial').hidden = false">Show tutorial</button>
            <section role="dialog" aria-label="Confirm your payment">
              <button>Continue billing</button>
            </section>
            <section id="tutorial" data-testid="${testId}" role="dialog" hidden>
              <span>Step 1 of 3</span>
              <button onclick="document.getElementById('tutorial').hidden = true">Skip</button>
            </section>
          `
        })
      )
      await new OnboardingCoachmarks(page).dismissWhenVisible()
      for (let visit = 0; visit < 2; visit++) {
        await page.goto('http://localhost:5173/')
        await page.getByRole('button', { name: 'Show tutorial' }).click()
        await page.getByRole('button', { name: 'Continue billing' }).click()
        await expect(page.getByTestId(testId)).toBeHidden()
        await expect(
          page.getByRole('dialog', { name: 'Confirm your payment' })
        ).toBeVisible()
      }
    })
  }

  test('completes disposable survey questions before waiting for the canvas', async ({
    page
  }) => {
    await test.step('Open a survey with option and text questions', async () => {
      await page.route('http://localhost:5173/', (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: `
          <h1>Let's get to know you</h1>
          <button id="intent-exploring" aria-pressed="false" onclick="this.hidden = true; document.getElementById('usage').hidden = false">Explore</button>
          <section id="usage" hidden>
            <input id="usage-answer" aria-label="Usage" oninput="document.getElementById('next').disabled = !this.value">
            <button id="next" disabled onclick="document.getElementById('usage').hidden = true; document.getElementById('details').hidden = false">Next</button>
          </section>
          <section id="details" hidden>
            <input id="details-answer" aria-label="Details" oninput="document.getElementById('submit').disabled = !this.value">
            <button id="submit" disabled>Submit</button>
          </section>

          <script>
            document.getElementById('submit').onclick = async () => {
              await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ onboarding_survey: { intent: 'exploring', usage: document.getElementById('usage-answer').value, details: document.getElementById('details-answer').value } })
              })
              document.querySelector('h1').hidden = true
              document.getElementById('details').hidden = true
              document.body.insertAdjacentHTML('beforeend', '<canvas id="graph-canvas"></canvas>')
            }
          </script>
        `
        })
      )
      await page.goto('http://localhost:5173/')
    })

    await test.step('Advance with Next, submit all answers and reach the canvas', async () => {
      const [request] = await Promise.all([
        page.waitForRequest(
          (request) =>
            request.url() === 'http://localhost:5173/api/settings' &&
            request.method() === 'POST'
        ),
        new LiveCloudOnboarding(page).completeSurveyIfNeeded(
          'http://localhost:5173'
        )
      ])
      expect(request.postDataJSON()).toEqual({
        onboarding_survey: {
          intent: 'exploring',
          usage: 'Automated billing E2E',
          details: 'Automated billing E2E'
        }
      })
      await expect(page.locator('#graph-canvas')).toBeVisible()
    })
  })

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
    expect(
      await page.evaluate(() =>
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ onboarding_survey: { intent: 'exploring' } })
        }).then((response) => response.text())
      )
    ).toBe('POST https://testcloud.comfy.org/api/settings')
    expect(sandboxProxy.requests).toEqual([
      'POST https://testcloud.comfy.org/api/auth/token',
      'POST https://testapi.comfy.org/customers',
      'POST https://testcloud.comfy.org/api/settings'
    ])
  })

  test('uses upstream responses for assets, location, Google auth, and flags', async ({
    context,
    sandboxProxy
  }) => {
    const page = await test.step('Open the local frontend', async () => {
      const page = await context.newPage()
      await page.route('http://localhost:5173/', (route) =>
        route.fulfill({ contentType: 'text/html', body: '<html></html>' })
      )
      await page.goto('http://localhost:5173/')
      return page
    })

    await test.step('Verify auxiliary services use upstream responses', async () => {
      for (const url of [
        'https://cloud.comfy.org/cdn-cgi/trace',
        'https://apis.google.com/js/api.js',
        'https://huggingface.co/example/resolve/main/model.safetensors',
        'https://t.comfy.org/flags/'
      ]) {
        expect(
          await page.evaluate(async (url) => {
            const response = await fetch(url)
            return await response.text()
          }, url)
        ).toBe(`GET ${url}`)
      }
      expect(
        await page.evaluate(() =>
          fetch('https://t.comfy.org/flags/', { method: 'POST' }).then(
            (response) => response.text()
          )
        )
      ).toBe('POST https://t.comfy.org/flags/')
      expect(sandboxProxy.requests).toContain('GET https://t.comfy.org/flags/')
    })
  })

  for (const path of [
    '/api/billing/subscribe',
    '/customers',
    'http://127.0.0.1:39281/collect',
    'https://api.stripe.com/v1/payment_pages/cs_test_example/init'
  ]) {
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
        `Mutation POST ${new URL(path, 'http://localhost:5173').href}`
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
      const survey = await api.post(
        'https://testcloud.comfy.org/api/settings',
        {
          data: { onboarding_survey: { intent: 'exploring' } }
        }
      )
      expect(await survey.text()).toBe(
        'POST https://testcloud.comfy.org/api/settings'
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
        'POST https://testcloud.comfy.org/api/auth/session',
        'POST https://testcloud.comfy.org/api/settings'
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

test.describe('Live Cloud checkout network boundary', () => {
  test.use({
    liveCloudBillingConfig: liveCloudBillingConfigSchema.parse({
      PLAYWRIGHT_TEST_URL: 'http://localhost:5173',
      PLAYWRIGHT_SETUP_API_URL: 'https://testcloud.comfy.org',
      CLOUD_ACCOUNT_EMAIL: 'routing@example.com',
      CLOUD_ACCOUNT_PASSWORD: 'unused',
      allowCheckout: true
    })
  })

  test('allows checkout handoff in browser and API clients', async ({
    page,
    request,
    context,
    sandboxProxy
  }) => {
    await page.route('http://localhost:5173/', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<html></html>' })
    )
    await page.goto('http://localhost:5173/')
    expect(
      await page.evaluate(() =>
        fetch('/api/billing/subscribe', { method: 'POST' }).then((response) =>
          response.text()
        )
      )
    ).toBe('POST https://testcloud.comfy.org/api/billing/subscribe')
    for (const api of [request, context.request]) {
      const response = await api.post(
        'https://testcloud.comfy.org/api/billing/subscribe'
      )
      expect(await response.text()).toBe(
        'POST https://testcloud.comfy.org/api/billing/subscribe'
      )
    }
    expect(sandboxProxy.requests).toEqual([
      'POST https://testcloud.comfy.org/api/billing/subscribe',
      'POST https://testcloud.comfy.org/api/billing/subscribe',
      'POST https://testcloud.comfy.org/api/billing/subscribe'
    ])
  })

  test('still rejects payment confirmation with checkout enabled', async ({
    context,
    networkPolicy
  }) => {
    await expect(
      context.request.post(
        'https://api.stripe.com/v1/payment_pages/cs_test_example/confirm'
      )
    ).rejects.toThrow('Forbidden live Cloud request')
    expect([...networkPolicy.unexpected]).toEqual([
      'Mutation POST https://api.stripe.com/v1/payment_pages/cs_test_example/confirm'
    ])
    test.fail(true, 'The recorded mutation must fail fixture teardown')
  })
})
