import { expect } from '@playwright/test'

import { ComfyPage, comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import {
  DESKTOP_RELAY_NONCE,
  recordOpenOnCloudTraffic
} from '@e2e/fixtures/helpers/openOnCloudTraffic'

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
      await new FeatureFlagHelper(page).seedServerFlags({
        open_on_cloud_enabled: false
      })
    })

    test('boots, loads and hovers the top menu without any Open on Cloud surface or traffic while the gate is off', async ({
      comfyPage,
      traffic
    }) => {
      await comfyPage.workflow.loadWorkflow('openOnCloud/01-runnable-on-cloud')
      await comfyPage.page.getByTestId('top-menu-actionbars').hover()

      await expect(comfyPage.page.getByTestId('cloud-button')).toHaveCount(0)
      expect(traffic).toEqual([])
    })
  })

  for (const nonce of [DESKTOP_RELAY_NONCE, 'not-a-uuid']) {
    test.describe(`disabled relay ${nonce}`, () => {
      test.use({
        initialUrl: `/?desktop_workflow=${nonce}&user=e2e-relay-user`
      })

      test.beforeEach(async ({ page }) => {
        await new FeatureFlagHelper(page).mergeServerFeatures({
          open_on_cloud_enabled: false
        })
      })

      test(`boots the editor from a Desktop relay link (${nonce}) without touching the transfer while the gate is off`, async ({
        comfyPage,
        traffic
      }) => {
        await comfyPage.waitForAppReady()

        expect(traffic).toEqual([])
      })
    })
  }

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
      await new FeatureFlagHelper(page).seedServerFlags({
        open_on_cloud_enabled: true
      })
    })

    test('shows the Cloud button while the gate is on, proving the gate-off check looks at the right control', async ({
      comfyPage
    }) => {
      await expect(comfyPage.page.getByTestId('cloud-button')).toBeVisible()
    })
  })
})
