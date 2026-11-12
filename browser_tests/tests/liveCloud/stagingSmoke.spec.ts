import { expect } from '@playwright/test'

import { liveOpenOnCloudLoginFixture as test } from '@e2e/fixtures/liveOpenOnCloudFixture'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import {
  collectAppChunkFailures,
  isBootConsoleErrorInEveryCloudEnvironment
} from '@e2e/fixtures/utils/deploymentSmoke'

test.describe(
  'Deployed Cloud frontend smoke (served version is verified by the release workflow, not here)',
  { tag: ['@staging-smoke'] },
  () => {
    test.beforeEach(async ({ page }) => {
      await page.route('https://www.googletagmanager.com/**', (route) =>
        route.fulfill({ contentType: 'application/javascript', body: '' })
      )
    })

    test('boots the signed-out entry point without console or app chunk failures', async ({
      page,
      cloudOrigin
    }) => {
      using appChunks = collectAppChunkFailures(page, cloudOrigin)
      using consoleErrors = collectConsoleErrors(page)

      await test.step('Load the schema-checked origin a signed-out visitor reaches', async () => {
        await page.goto(cloudOrigin, { waitUntil: 'load' })
      })

      await test.step('Serve every app chunk the boot requested', () => {
        expect(
          appChunks.failures,
          'Failed same-origin JS/CSS requests'
        ).toEqual([])
      })

      await test.step('Render the signed-out login shell', async () => {
        await expect
          .soft(page.getByRole('heading', { name: 'Log in to your account' }))
          .toBeVisible({ timeout: 10_000 })
        await expect
          .soft(page.getByRole('button', { name: /log in with google/i }))
          .toBeVisible({ timeout: 10_000 })
      })

      await test.step('Serve every app chunk the rendered page requested', async () => {
        await expect
          .poll(() => appChunks.pendingCount, {
            message: 'Same-origin JS/CSS requests still in flight'
          })
          .toBe(0)
        expect
          .soft(appChunks.failures, 'Failed same-origin JS/CSS requests')
          .toEqual([])
      })

      await test.step('Boot without console errors or uncaught exceptions', () => {
        expect(
          consoleErrors.errors.filter(
            (error) => !isBootConsoleErrorInEveryCloudEnvironment(error)
          ),
          'Console errors during boot'
        ).toEqual([])
      })

      await test.info().attach('staging-smoke.png', {
        body: await page.screenshot(),
        contentType: 'image/png'
      })
    })
  }
)
