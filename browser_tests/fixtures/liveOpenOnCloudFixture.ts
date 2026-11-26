import { expect } from '@playwright/test'
import type { CloudWorkflowCompatibility } from '@comfyorg/ingest-types'
import { zCloudCompatibility } from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { LoginButton } from '@e2e/fixtures/components/LoginButton'
import { OpenOnCloudDialog } from '@e2e/fixtures/components/OpenOnCloudDialog'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'
import { getLiveCloudCustomerOrigin } from '@e2e/fixtures/utils/liveCloudBillingConfig'

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

const liveOpenOnCloudFixture = base.extend<{
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
    await comfyPage.goto()
    await comfyPage.waitForAppReady()
    const templates = page.getByRole('dialog', {
      name: 'Get Started with a Template',
      exact: true
    })
    if (await templates.isVisible()) {
      await templates
        .getByRole('button', { name: 'Close dialog', exact: true })
        .press('Escape')
    }
    await expect(comfyPage.canvas).toBeVisible()
    await use(comfyPage)
  }
})

export const liveOpenOnCloudLoginFixture = liveOpenOnCloudFixture.extend<{
  cloudAccount: { email: string; password: string }
}>({
  cloudAccount: async ({ cloudOrigin }, use) => {
    const email = process.env.CLOUD_ACCOUNT_EMAIL
    const password = process.env.CLOUD_ACCOUNT_PASSWORD
    if (!email || !password) {
      throw new Error(
        `Set CLOUD_ACCOUNT_EMAIL and CLOUD_ACCOUNT_PASSWORD for an onboarded Cloud account at ${cloudOrigin}. See docs/testing/open-on-cloud-e2e.md.`
      )
    }
    await use({ email, password })
  },
  liveNetworkOrigins: async ({ liveNetworkOrigins, cloudOrigin }, use) => {
    const customerOrigin = getLiveCloudCustomerOrigin(
      cloudOriginSchema.parse(cloudOrigin)
    )
    await use([
      ...liveNetworkOrigins,
      ...(customerOrigin ? [customerOrigin] : []),
      'https://mp.comfy.org',
      'https://consumer.cloud.gist.build',
      'https://realtime.cloud.gist.build',
      'https://ajax.googleapis.com',
      'https://e2.sy-d.io',
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

export const liveOpenOnCloudAcceptanceFixture = liveOpenOnCloudFixture.extend<{
  loginButton: LoginButton
  openOnCloudDialog: OpenOnCloudDialog
  checkCloudCompatibility: () => Promise<CloudWorkflowCompatibility>
}>({
  loginButton: async ({ page }, use) => {
    await use(new LoginButton(page))
  },
  openOnCloudDialog: async ({ page }, use) => {
    await use(new OpenOnCloudDialog(page))
  },
  checkCloudCompatibility: async ({ comfyPage, cloudOrigin }, use) => {
    await use(async () => {
      const { page, actionbar } = comfyPage
      const [response] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url() === `${cloudOrigin}/api/cloud/compatibility` &&
            response.request().method() === 'POST'
        ),
        actionbar.checkCloudCompatibility()
      ])
      expect(response.status()).toBe(200)
      expect(await response.serverAddr()).not.toBeNull()
      return zCloudCompatibility.parse(await response.json()).cloud
    })
  }
})
