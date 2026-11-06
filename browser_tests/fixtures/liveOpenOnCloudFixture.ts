import { expect } from '@playwright/test'
import { z } from 'zod'

import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

const cloudOriginSchema = z
  .url()
  .refine((value) => {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.href === `${url.origin}/` &&
      /^(testcloud\.comfy\.org|stagingcloud\.comfy\.org|(?:fe-)?pr-\d+\.testenvs\.comfy\.org)$/.test(
        url.hostname
      )
    )
  }, 'OPEN_ON_CLOUD_URL must be a test, staging, or PR preview origin')
  .transform((value) => new URL(value).origin)

export const liveOpenOnCloudFixture = base.extend<{
  cloudOrigin: string
  comfyPage: ComfyPage
}>({
  baseURL: process.env.PLAYWRIGHT_TEST_URL,
  cloudOrigin: [
    process.env.OPEN_ON_CLOUD_URL?.replace(/\/$/, '') ?? '',
    { option: true }
  ],
  liveNetworkOrigins: async ({ cloudOrigin }, use) => {
    await use([
      cloudOriginSchema.parse(cloudOrigin),
      'https://api.comfy.org',
      'https://stagingapi.comfy.org',
      'https://cloud.comfy.org',
      'https://testcloud.comfy.org',
      'https://media.comfy.org',
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      'https://dreamboothy-dev.firebaseapp.com',
      'https://apis.google.com',
      'https://www.gstatic.com',
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
      'https://huggingface.co'
    ])
  },
  comfyPage: async ({ page, request }, use) => {
    const comfyPage = new ComfyPage(page, request)
    // A completed tutorial keeps the first-run templates dialog from opening
    // over the editor, so no test races its arrival.
    const tutorial = await request.post(
      new URL('/api/settings/Comfy.TutorialCompleted', comfyPage.url).href,
      { headers: { 'Comfy-User': 'default' }, data: true }
    )
    expect(tutorial.status()).toBe(200)
    await comfyPage.goto()
    await comfyPage.waitForAppReady()
    await expect(comfyPage.canvas).toBeVisible()
    await use(comfyPage)
  }
})

export const liveOpenOnCloudLoginFixture = liveOpenOnCloudFixture.extend({
  liveNetworkOrigins: async ({ liveNetworkOrigins }, use) => {
    await use([
      ...liveNetworkOrigins,
      'https://browser-intake-us5-datadoghq.com',
      'https://utt.impactcdn.com',
      'https://comfyui.sjv.io',
      'https://d.impct.site',
      'https://www.ojrq.net',
      'https://cdn.sy-d.io',
      'https://t.comfy.org',
      'https://o4507954455314432.ingest.us.sentry.io',
      'https://cdp.customer.io'
    ])
  }
})
