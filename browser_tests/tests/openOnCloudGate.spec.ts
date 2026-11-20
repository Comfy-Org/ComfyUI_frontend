import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  DESKTOP_RELAY_NONCE,
  recordOpenOnCloudTraffic
} from '@e2e/fixtures/helpers/openOnCloudTraffic'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { mockWorkspace, workspace } from '@e2e/fixtures/utils/workspaceMocks'

const openOnCloudEnabledTest = test.extend({
  page: async ({ page }, use) => {
    await page.route(
      'https://{cloud,stagingcloud,testcloud}.comfy.org/api/features',
      (route) =>
        route.request().method() === 'GET'
          ? route.fulfill({
              headers: { 'access-control-allow-origin': '*' },
              json: { open_on_cloud_enabled: true }
            })
          : route.fallback()
    )
    await use(page)
  }
})

const signedInTest = openOnCloudEnabledTest.extend({
  page: async ({ page }, use) => {
    await mockWorkspace(page, workspace('personal', 'owner'), [])
    await mockBilling(page)
    await page.route(
      'https://{cloud,stagingcloud,testcloud}.comfy.org/api/auth/token/revoke',
      (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({
              headers: { 'access-control-allow-origin': '*' },
              status: 204
            })
          : route.fallback()
    )
    await use(page)
  }
})

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
    test(`boots the editor from a Desktop relay link (${nonce}) without touching the transfer while the gate is off`, async ({
      comfyPage
    }) => {
      await comfyPage.featureFlags.mergeServerFeatures({
        open_on_cloud_enabled: false
      })
      const traffic = recordOpenOnCloudTraffic(comfyPage.page)

      await comfyPage.goto({
        url: `/?desktop_workflow=${nonce}&user=e2e-relay-user`
      })
      await comfyPage.waitForAppReady()

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

  openOnCloudEnabledTest(
    'shows the Cloud button before sign-in',
    async ({ comfyPage }) => {
      await expect(comfyPage.page.getByTestId('login-button')).toBeVisible()
      await expect(comfyPage.page.getByTestId('cloud-button')).toBeVisible()
    }
  )

  signedInTest(
    'keeps the Cloud button available after sign-out',
    { tag: '@auth' },
    async ({ comfyPage }) => {
      const { page } = comfyPage
      const cloudButton = page.getByTestId('cloud-button')

      await expect(cloudButton).toBeVisible()
      await comfyPage.toast.closeToasts()
      await page.getByTestId('current-user-button').click()
      await page.getByTestId('logout-menu-item').click()
      await expect(page.getByTestId('login-button')).toBeVisible()
      await expect(cloudButton).toBeVisible()
    }
  )
})
