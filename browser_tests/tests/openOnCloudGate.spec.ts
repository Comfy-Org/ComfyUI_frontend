import type { Request } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

function isOpenOnCloudTraffic(request: Request): boolean {
  const url = new URL(request.url())
  return (
    url.pathname.endsWith('/api/cloud/compatibility') ||
    decodeURIComponent(url.pathname).includes('/userdata/open-on-cloud/')
  )
}

// CI serves a production build, where the `ff:` localStorage override is
// tree-shaken, so the gate is driven through the server feature-flag handshake.
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
    expect(comfyPage.page.url()).not.toContain('desktop_workflow')
    expect(traffic).toEqual([])
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
