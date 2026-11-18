import { expect } from '@playwright/test'
import type { CloudWorkflowCompatibility } from '@comfyorg/ingest-types'
import { zCloudCompatibility } from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { LoginButton } from '@e2e/fixtures/components/LoginButton'
import { OpenOnCloudDialog } from '@e2e/fixtures/components/OpenOnCloudDialog'
import { SignInDialog } from '@e2e/fixtures/components/SignInDialog'
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

export const liveOpenOnCloudAcceptanceFixture = liveOpenOnCloudFixture.extend<{
  loginButton: LoginButton
  openOnCloudDialog: OpenOnCloudDialog
  signIn: () => Promise<void>
  checkCloudCompatibility: () => Promise<CloudWorkflowCompatibility>
}>({
  loginButton: async ({ page }, use) => {
    await use(new LoginButton(page))
  },
  openOnCloudDialog: async ({ page }, use) => {
    await use(new OpenOnCloudDialog(page))
  },
  signIn: async ({ comfyPage, cloudOrigin, loginButton }, use) => {
    await use(async () => {
      const email = process.env.OPEN_ON_CLOUD_ENABLED_EMAIL
      const password = process.env.OPEN_ON_CLOUD_ENABLED_PASSWORD
      if (!email || !password) {
        throw new Error(
          'Set OPEN_ON_CLOUD_ENABLED_EMAIL and OPEN_ON_CLOUD_ENABLED_PASSWORD'
        )
      }

      const { page, currentUserPopover } = comfyPage
      const dialog = new SignInDialog(page)
      await loginButton.trigger.click()
      const [response] = await Promise.all([
        page.waitForResponse(async (response) => {
          const request = response.request()
          return (
            response.url() === `${cloudOrigin}/api/features` &&
            request.method() === 'GET' &&
            Boolean(await request.headerValue('authorization'))
          )
        }),
        dialog.submitEmailAndPassword(email, password)
      ])
      expect(response.status()).toBe(200)
      expect(await response.serverAddr()).not.toBeNull()
      expect(await response.json()).toMatchObject({
        open_on_cloud_enabled: true
      })
      await expect(currentUserPopover.trigger).toBeVisible()
      await expect(dialog.emailInput).toBeHidden()
    })
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
        actionbar.cloudButton.click()
      ])
      expect(response.status()).toBe(200)
      expect(await response.serverAddr()).not.toBeNull()
      return zCloudCompatibility.parse(await response.json()).cloud
    })
  }
})
