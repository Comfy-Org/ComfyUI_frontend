import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  DESKTOP_RELAY_NONCE,
  recordOpenOnCloudTraffic
} from '@e2e/fixtures/helpers/openOnCloudTraffic'
import { localAuthFixture } from '@e2e/fixtures/localAuthFixture'

test.describe('Open on Cloud gate', { tag: ['@ui'] }, () => {
  test('hides the Cloud button and skips handoff traffic while signed out even when local flags enable it', async ({
    comfyPage
  }) => {
    await comfyPage.featureFlags.mergeServerFeatures({
      open_on_cloud_enabled: true
    })
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

  localAuthFixture(
    'shows the Cloud button when Cloud enables it for the signed-in account',
    async ({ comfyPage }) => {
      await comfyPage.page.route(
        'https://{cloud,stagingcloud,testcloud}.comfy.org/api/features',
        (route) =>
          route.fulfill({
            headers: { 'access-control-allow-origin': '*' },
            json: {
              open_on_cloud_enabled: Boolean(
                route.request().headers().authorization
              )
            }
          })
      )

      await comfyPage.workflow.reloadAndWaitForApp()

      await expect(comfyPage.page.getByTestId('cloud-button')).toBeVisible()
    }
  )
})
