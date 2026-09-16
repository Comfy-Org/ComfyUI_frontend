import { expect } from '@playwright/test'

import { liveCloudBillingFixture as test } from '@e2e/fixtures/liveCloudBillingFixture'

test.use({
  liveCloudBillingConfig: {
    PLAYWRIGHT_TEST_URL: 'https://frontend.invalid',
    PLAYWRIGHT_SETUP_API_URL: 'https://backend.invalid',
    CLOUD_ACCOUNT_EMAIL: 'routing@example.com',
    CLOUD_ACCOUNT_PASSWORD: 'unused'
  }
})

test.describe('Live Cloud network boundary', { tag: '@smoke' }, () => {
  for (const path of ['/api/billing/subscribe', '/customers']) {
    test(`blocks POST ${path} and fails even when the app catches it`, async ({
      page,
      networkPolicy
    }) => {
      await page.route('https://frontend.invalid/', (route) =>
        route.fulfill({ contentType: 'text/html', body: '<html></html>' })
      )
      await page.goto('https://frontend.invalid/')
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
        `Mutation POST https://frontend.invalid${path}`
      ])
      test.fail(true, 'The recorded mutation must fail fixture teardown')
    })
  }

  for (const client of ['request', 'context.request'] as const) {
    test(`${client} retains the API origin and mutation guards`, async ({
      request,
      context,
      networkPolicy
    }) => {
      const api = client === 'request' ? request : context.request
      await expect(api.get('https://external.invalid/api')).rejects.toThrow(
        'Unexpected external request'
      )
      await expect(
        api.post('https://backend.invalid/internal/reset')
      ).rejects.toThrow('Forbidden live Cloud request')
      await expect(
        api.post('https://frontend.invalid/api/auth/token')
      ).rejects.toThrow('Forbidden live Cloud request')
      expect([...networkPolicy.unexpected]).toEqual([
        'API https://external.invalid/api',
        'Mutation POST https://backend.invalid/internal/reset',
        'Mutation POST https://frontend.invalid/api/auth/token'
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
