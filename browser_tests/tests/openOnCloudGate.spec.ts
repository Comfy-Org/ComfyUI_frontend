import { expect } from '@playwright/test'

import { ComfyPage, comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { SignInDialog } from '@e2e/fixtures/components/SignInDialog'
import { CLOUD_SELF_EMAIL } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import {
  DESKTOP_RELAY_NONCE,
  recordOpenOnCloudTraffic
} from '@e2e/fixtures/helpers/openOnCloudTraffic'
import { localSignedOutFixture as authTest } from '@e2e/fixtures/localSignedOutFixture'

const test = comfyPageFixture.extend<{ traffic: string[] }>({
  traffic: [
    async ({ page }, use) => {
      await use(recordOpenOnCloudTraffic(page))
    },
    { auto: true }
  ]
})

test.describe('Open on Cloud gate', { tag: ['@ui'] }, () => {
  test.describe('disabled menu', () => {
    test.beforeEach(async ({ page }) => {
      await page.route(
        (url) => url.protocol === 'https:' && url.pathname === '/api/features',
        (route) =>
          route.fulfill({
            headers: { 'access-control-allow-origin': '*' },
            json: { open_on_cloud_enabled: false }
          })
      )
    })

    test('boots, loads and hovers the top menu without a Cloud button or handoff traffic when Cloud disables it', async ({
      comfyPage,
      traffic
    }) => {
      await comfyPage.workflow.loadWorkflow('openOnCloud/01-runnable-on-cloud')
      await comfyPage.page.getByTestId('top-menu-actionbars').hover()

      await expect(comfyPage.page.getByTestId('cloud-button')).toHaveCount(0)
      expect(traffic).toEqual([])
    })
  })

  test('shows a disabled message and leaves a staged Desktop transfer unread', async ({
    page,
    request,
    traffic
  }) => {
    const comfyPage = new ComfyPage(page, request)
    await comfyPage.featureFlags.mergeServerFeatures({
      open_on_cloud_enabled: false
    })

    await comfyPage.goto({
      url: `/?desktop_workflow=${DESKTOP_RELAY_NONCE}&user=e2e-relay-user`
    })

    await expect(
      page.getByRole('status', {
        name: 'Open on Comfy Cloud is currently unavailable for this editor.'
      })
    ).toBeVisible()
    expect(traffic).toEqual([])
  })

  test.describe('invalid relay link when Cloud is disabled', () => {
    test.use({
      initialUrl: '/?desktop_workflow=not-a-uuid&user=e2e-relay-user'
    })

    test.beforeEach(async ({ page }) => {
      await new FeatureFlagHelper(page).mergeServerFeatures({
        open_on_cloud_enabled: false
      })
    })

    test('boots the editor without requesting a transfer', async ({
      comfyPage,
      traffic
    }) => {
      await comfyPage.waitForAppReady()
      expect(traffic).toEqual([])
    })
  })

  test('reads the staged transfer from a Desktop relay link while the gate is on, proving the gate-off check watches the right request', async ({
    page,
    request,
    traffic
  }) => {
    const comfyPage = new ComfyPage(page, request)
    await comfyPage.featureFlags.mergeServerFeatures({
      open_on_cloud_enabled: true
    })

    await comfyPage.goto({
      url: `/?desktop_workflow=${DESKTOP_RELAY_NONCE}&user=e2e-relay-user`
    })

    await expect
      .poll(() => traffic)
      .toContainEqual(
        expect.stringContaining(`open-on-cloud/${DESKTOP_RELAY_NONCE}`)
      )
  })

  test.describe('enabled menu', () => {
    test.beforeEach(async ({ page }) => {
      await page.route(
        (url) => url.protocol === 'https:' && url.pathname === '/api/features',
        (route) => {
          expect(route.request().headers().authorization).toBeUndefined()
          return route.fulfill({
            headers: { 'access-control-allow-origin': '*' },
            json: { open_on_cloud_enabled: true }
          })
        }
      )
    })

    test('shows the Cloud button before sign-in when Cloud returns the existing flag', async ({
      comfyPage
    }) => {
      await expect(comfyPage.page.getByTestId('cloud-button')).toBeVisible()
    })
  })
})

for (const granted of [true, false]) {
  authTest(
    `applies the authenticated Cloud rollout (${granted}) after sign-in`,
    async ({ comfyPage }) => {
      const { page } = comfyPage
      await comfyPage.cloudAuth.mockLiveEmailSignIn()
      await page.route(
        (url) => url.protocol === 'https:' && url.pathname === '/api/features',
        async (route) => {
          const authenticated = await route
            .request()
            .headerValue('authorization')
          await route.fulfill({
            headers: { 'access-control-allow-origin': '*' },
            json: { open_on_cloud_enabled: Boolean(authenticated) && granted }
          })
        }
      )
      const served = page.waitForResponse(async (response) => {
        const url = new URL(response.url())
        return (
          url.protocol === 'https:' &&
          url.pathname === '/api/features' &&
          Boolean(await response.request().headerValue('authorization'))
        )
      })
      const dialog = new SignInDialog(page)
      await dialog.open()
      await dialog.emailInput.fill(CLOUD_SELF_EMAIL)
      await dialog.passwordInput.fill('correct-horse-battery-staple')
      await dialog.signInButton.click()

      expect((await served).ok()).toBe(true)
      await expect(dialog.root).toBeHidden()
      if (granted) {
        await expect(page.getByTestId('cloud-button')).toBeVisible()
      } else {
        await expect(page.getByTestId('cloud-button')).toHaveCount(0)
      }
    }
  )
}
