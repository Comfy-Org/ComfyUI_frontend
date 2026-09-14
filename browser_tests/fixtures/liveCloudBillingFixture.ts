import { expect } from '@playwright/test'

import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'
import {
  installLiveCloudBillingRouting,
  signInToLiveCloud
} from '@e2e/fixtures/utils/liveCloudBillingContext'
import { loadLiveCloudBillingConfig } from '@e2e/fixtures/utils/liveCloudBillingConfig'

export const liveCloudBillingFixture = base.extend<{
  comfyPage: ComfyPage
}>({
  baseURL: process.env.PLAYWRIGHT_TEST_URL,
  networkPolicy: async ({ baseURL }, use, testInfo) => {
    const config = loadLiveCloudBillingConfig()
    const origins = new Set([
      new URL(baseURL ?? config.PLAYWRIGHT_TEST_URL).origin,
      config.PLAYWRIGHT_SETUP_API_URL,
      ...(config.PLAYWRIGHT_SETUP_API_URL === 'https://testcloud.comfy.org'
        ? ['https://testapi.comfy.org']
        : []),
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      'https://dreamboothy-dev.firebaseapp.com'
    ])
    const unexpected = new Set<string>()
    await use({ origins, unexpected })
    const blocked = [...unexpected]
    await testInfo.attach('blocked-egress.json', {
      body: JSON.stringify(blocked),
      contentType: 'application/json'
    })
    expect(
      blocked.filter((entry) => /^(API|Navigation) /.test(entry)),
      'Unexpected API or navigation destination'
    ).toEqual([])
  },
  context: async ({ context, networkPolicy }, use) => {
    await installLiveCloudBillingRouting(context, networkPolicy)
    await use(context)
    await context.unrouteAll({ behavior: 'ignoreErrors' })
  },
  comfyPage: async ({ page, request }, use) => {
    await signInToLiveCloud(page)
    await use(new ComfyPage(page, request))
  }
})
