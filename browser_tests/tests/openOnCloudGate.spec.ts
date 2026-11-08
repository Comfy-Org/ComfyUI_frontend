import type { Page, Request } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

function isOpenOnCloudTraffic(request: Request): boolean {
  const url = new URL(request.url())
  return (
    url.pathname.endsWith('/api/cloud/compatibility') ||
    decodeURIComponent(url.pathname).includes('/userdata/open-on-cloud/')
  )
}

const RELAY_NONCE = '3f1c2b7e-9a4d-4c1e-8b2f-6d5e4a3b2c1d'

async function serveOpenOnCloudFlag(page: Page, enabled: boolean) {
  await page.route('**/api/features', async (route) => {
    const response = await route.fetch()
    await route.fulfill({
      response,
      json: { ...(await response.json()), open_on_cloud_enabled: enabled }
    })
  })
}

function recordOpenOnCloudTraffic(page: Page): string[] {
  const traffic: string[] = []
  page.on('request', (request) => {
    if (isOpenOnCloudTraffic(request)) traffic.push(request.url())
  })
  return traffic
}

test.describe('Open on Cloud gate', { tag: ['@ui'] }, () => {
  test('boots, loads and hovers the top menu without any Open on Cloud surface or traffic while the gate is off', async ({
    comfyPage
  }) => {
    await comfyPage.featureFlags.seedServerFlags({
      open_on_cloud_enabled: false
    })
    const traffic: string[] = []
    comfyPage.page.on('request', (request) => {
      if (isOpenOnCloudTraffic(request)) traffic.push(request.url())
    })

    await comfyPage.workflow.reloadAndWaitForApp()
    await comfyPage.workflow.loadWorkflow('openOnCloud/01-runnable-on-cloud')
    await comfyPage.page.getByTestId('top-menu-actionbars').hover()

    await expect(comfyPage.page.getByTestId('cloud-button')).toHaveCount(0)
    expect(traffic).toEqual([])
  })

  for (const nonce of [RELAY_NONCE, 'not-a-uuid']) {
    test(`boots the editor from a Desktop relay link (${nonce}) without touching the transfer while the gate is off`, async ({
      comfyPage
    }) => {
      await serveOpenOnCloudFlag(comfyPage.page, false)
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
    await serveOpenOnCloudFlag(comfyPage.page, true)
    const traffic = recordOpenOnCloudTraffic(comfyPage.page)

    await comfyPage.goto({
      url: `/?desktop_workflow=${RELAY_NONCE}&user=e2e-relay-user`
    })

    await expect
      .poll(() => traffic.map(decodeURIComponent))
      .toContainEqual(expect.stringContaining(`open-on-cloud/${RELAY_NONCE}`))
  })

  test('shows the Cloud button while the gate is on, proving the gate-off check looks at the right control', async ({
    comfyPage
  }) => {
    await comfyPage.featureFlags.seedServerFlags({
      open_on_cloud_enabled: true
    })

    await comfyPage.workflow.reloadAndWaitForApp()

    await expect(comfyPage.page.getByTestId('cloud-button')).toBeVisible()
  })
})
