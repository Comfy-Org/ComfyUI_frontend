import { join } from 'node:path'

import type { BrowserContext } from '@playwright/test'
import { expect } from '@playwright/test'

import { websiteRoot } from '@website/paths'
import { test } from './fixtures/blockExternalMedia'
import {
  MODELS_WORKSPACE_TOKEN,
  test as signedInTest
} from './fixtures/modelsAccount'
import { mockOpenjutsuProxy } from './fixtures/openjutsuProxy'

const asset = (name: string) => join(websiteRoot, 'e2e/assets', name)

async function mockFlags(context: BrowserContext, openjutsu: boolean) {
  await context.route('**/t.comfy.org/**', (route) =>
    /\/(flags|decide)\//.test(route.request().url())
      ? route.fulfill({
          contentType: 'application/json',
          json: {
            featureFlags: {
              'workshop-enabled': true,
              'workshop-apps-enabled': true,
              'workshop-auth': true,
              'workshop-openjutsu-app-enabled': openjutsu
            },
            featureFlagPayloads: {}
          }
        })
      : route.abort('blockedbyclient')
  )
}

test('keeps Openjutsu closed while its flag is off', async ({
  page,
  context
}) => {
  await mockFlags(context, false)
  await page.goto('/hub/apps/openjutsu/')
  await expect(page.getByTestId('openjutsu')).toHaveCount(0)
})

signedInTest(
  'swaps a character through the app proxy, at the price the page showed',
  async ({ page, context, modelsAccount }) => {
    await mockFlags(context, true)
    // Firebase waits for gapi's onload, which the empty stub never calls.
    await context.route('https://apis.google.com/js/api.js*', (route) =>
      route.abort('blockedbyclient')
    )
    const proxy = await mockOpenjutsuProxy(page, MODELS_WORKSPACE_TOKEN)
    await page.goto('/login/')
    await page.getByRole('button', { name: 'Use email instead' }).click()
    await page.getByLabel('Email').fill(modelsAccount.email)
    await page
      .getByLabel('Password', { exact: true })
      .fill(modelsAccount.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL('/')

    await page.goto('/hub/apps/openjutsu/')
    await page
      .getByTestId('openjutsu-video-file')
      .setInputFiles(asset('validation-16s.mp4'))
    await expect(
      page.getByTestId('video-trim-dialog'),
      "a visitor's own video opens the trim first"
    ).toBeVisible()
    await page.getByTestId('video-trim-confirm').click()
    await page
      .getByTestId('openjutsu-character-file')
      .setInputFiles(asset('placeholder-1x1.webp'))
    await page.getByLabel('Who to replace').fill('the man')

    // The longest part, 345 frames, at the quote's rate per frame.
    await expect(page.getByTestId('openjutsu-price')).toHaveText('360 credits')
    await page.getByTestId('openjutsu-action').click()

    await expect
      .poll(() => proxy)
      .toContain('GET /jobs/e2e-openjutsu-swap/outputs/out/content')
    expect(proxy.filter((call) => call === 'POST /assets')).toHaveLength(2)
    expect(proxy.filter((call) => call === 'POST /jobs')).toHaveLength(1)
  }
)
