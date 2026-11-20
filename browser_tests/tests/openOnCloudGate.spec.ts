import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { SignInDialog } from '@e2e/fixtures/components/SignInDialog'
import { CLOUD_SELF_EMAIL } from '@e2e/fixtures/helpers/CloudAuthHelper'
import {
  DESKTOP_RELAY_NONCE,
  recordOpenOnCloudTraffic
} from '@e2e/fixtures/helpers/openOnCloudTraffic'
import { localSignedOutFixture as authTest } from '@e2e/fixtures/localSignedOutFixture'

test.describe('Open on Cloud gate', { tag: ['@ui'] }, () => {
  test('boots, loads and hovers the top menu without a Cloud button or handoff traffic when Cloud disables it', async ({
    comfyPage
  }) => {
    await comfyPage.page.route(
      (url) => url.protocol === 'https:' && url.pathname === '/api/features',
      (route) =>
        route.fulfill({
          headers: { 'access-control-allow-origin': '*' },
          json: { open_on_cloud_enabled: false }
        })
    )
    const traffic = recordOpenOnCloudTraffic(comfyPage.page)

    await comfyPage.workflow.reloadAndWaitForApp()
    await comfyPage.workflow.loadWorkflow('openOnCloud/01-runnable-on-cloud')
    await comfyPage.page.getByTestId('top-menu-actionbars').hover()

    await expect(comfyPage.page.getByTestId('cloud-button')).toHaveCount(0)
    expect(traffic).toEqual([])
  })

  for (const nonce of [DESKTOP_RELAY_NONCE, 'not-a-uuid']) {
    test(`leaves the Desktop transfer unread (${nonce}) while the gate is off`, async ({
      comfyPage
    }) => {
      await comfyPage.featureFlags.mergeServerFeatures({
        open_on_cloud_enabled: false
      })
      const traffic = recordOpenOnCloudTraffic(comfyPage.page)

      await comfyPage.goto({
        url: `/?desktop_workflow=${nonce}&user=e2e-relay-user`
      })
      if (nonce === DESKTOP_RELAY_NONCE) {
        await expect(
          comfyPage.page.getByRole('status', {
            name: 'Open on Comfy Cloud is currently unavailable for this editor.'
          })
        ).toBeVisible()
      } else {
        await comfyPage.waitForAppReady()
      }

      expect(traffic).toEqual([])
    })
  }

  test('reads the staged transfer from a Desktop relay link while the gate is on, proving the gate-off check watches the right request', async ({
    comfyPage
  }) => {
    await comfyPage.featureFlags.mergeServerFeatures({
      open_on_cloud_enabled: true
    })
    const traffic = recordOpenOnCloudTraffic(comfyPage.page)

    await comfyPage.goto({
      url: `/?desktop_workflow=${DESKTOP_RELAY_NONCE}&user=e2e-relay-user`
    })

    await expect
      .poll(() => traffic)
      .toContainEqual(
        expect.stringContaining(`open-on-cloud/${DESKTOP_RELAY_NONCE}`)
      )
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
