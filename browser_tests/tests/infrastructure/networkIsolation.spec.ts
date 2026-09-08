import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { apiKeyAuthFixture } from '@e2e/fixtures/apiKeyAuthFixture'
import { cloudAppFixture } from '@e2e/fixtures/cloudAppFixture'
import { localAuthFixture } from '@e2e/fixtures/localAuthFixture'
import { templateApiFixture } from '@e2e/fixtures/templateApiFixture'
import { workspaceRailAuthFixture } from '@e2e/fixtures/workspaceRailAuthFixture'

test.describe('Network isolation', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ page }) => {
    const frontend = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
    await page.goto(`${frontend}/api/users`)
  })

  test('retains page mock precedence and intercepts the first popup request', async ({
    page,
    context
  }) => {
    await context.route('https://network-test.invalid/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: 'context mock' })
    )
    await page.route('https://network-test.invalid/**', (route) =>
      route.fulfill({ body: 'page mock' })
    )
    expect(
      await page.evaluate(() =>
        fetch('https://network-test.invalid/data').then((response) =>
          response.text()
        )
      )
    ).toBe('page mock')

    const popupPromise = context.waitForEvent('page')
    await page.evaluate(() => window.open('https://network-test.invalid/popup'))
    const popup = await popupPromise
    await expect(popup.locator('body')).toHaveText('context mock')
    await expect(popup).toHaveURL('https://network-test.invalid/popup')
  })

  test('keeps real backend WebSocket messages', async ({ page }) => {
    const backend =
      process.env.PLAYWRIGHT_SETUP_API_URL ||
      process.env.PLAYWRIGHT_TEST_URL ||
      'http://localhost:8188'
    const url = new URL('ws', `${backend}/`)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    const message = await page.evaluate(
      (url) =>
        new Promise<string>((resolve, reject) => {
          const socket = new WebSocket(url)
          socket.onmessage = (event) => {
            resolve(event.data)
            socket.close()
          }
          socket.onerror = () => reject(new Error('Backend WebSocket failed'))
        }),
      url.toString()
    )
    expect(JSON.parse(message)).toMatchObject({ type: 'status' })
  })

  test('blocks service worker registration', async ({ page, context }) => {
    await page.route('**/network-test-sw.js', (route) =>
      route.fulfill({ contentType: 'application/javascript', body: '' })
    )
    await expect(
      page.evaluate(() =>
        navigator.serviceWorker.register('/network-test-sw.js')
      )
    ).resolves.toBeUndefined()
    expect(context.serviceWorkers()).toHaveLength(0)
  })

  test('fails the owning test even when an external fetch error is caught', async ({
    page
  }) => {
    expect(
      await page.evaluate(() =>
        fetch('https://network-test.invalid/data').then(
          () => 'loaded',
          () => 'blocked'
        )
      )
    ).toBe('blocked')
    test.fail(
      true,
      'The network fixture must report the blocked request at teardown'
    )
  })

  test('fails the owning test for an external WebSocket', async ({ page }) => {
    await expect(
      page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            const socket = new WebSocket('wss://network-test.invalid/socket')
            socket.onclose = () => resolve()
          })
      )
    ).resolves.toBeUndefined()
    test.fail(
      true,
      'The network fixture must report the blocked WebSocket at teardown'
    )
  })

  test('fails the owning test for an unmocked popup', async ({
    page,
    context
  }) => {
    const failedRequest = context.waitForEvent('requestfailed', {
      predicate: (request) =>
        request.url() === 'https://network-test.invalid/popup'
    })
    await page.evaluate(() => window.open('https://network-test.invalid/popup'))
    expect((await failedRequest).failure()?.errorText).toContain(
      'ERR_BLOCKED_BY_CLIENT'
    )
    test.fail(
      true,
      'The network fixture must report the blocked popup at teardown'
    )
  })

  test('guards every API verb, including context.request', async ({
    request,
    context
  }) => {
    for (const method of [
      'get',
      'post',
      'put',
      'patch',
      'delete',
      'head',
      'fetch'
    ] as const) {
      for (const api of [request, context.request]) {
        await expect(
          api[method]('https://network-test.invalid/api')
        ).rejects.toThrow('Unexpected external request')
      }
    }
    test.fail(
      true,
      'The network fixture must report caught API errors at teardown'
    )
  })
})

for (const [name, fixture] of [
  ['cloudAppFixture', cloudAppFixture],
  ['localAuthFixture', localAuthFixture],
  ['templateApiFixture', templateApiFixture],
  ['workspaceRailAuthFixture', workspaceRailAuthFixture],
  ['apiKeyAuthFixture', apiKeyAuthFixture]
] as const) {
  fixture(
    `${name} reports external requests at teardown`,
    { tag: '@smoke' },
    async ({ page }) => {
      const frontend =
        process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
      await page.goto(`${frontend}/api/users`)
      expect(
        await page.evaluate(() =>
          fetch('https://network-test.invalid/data').then(
            () => 'loaded',
            () => 'blocked'
          )
        )
      ).toBe('blocked')
      fixture.fail(
        true,
        'The fixture must report the blocked request at teardown'
      )
    }
  )
}
