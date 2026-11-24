import { expect } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { mockWorkspace, workspace } from '@e2e/fixtures/utils/workspaceMocks'

const CORS = { 'access-control-allow-origin': '*' }
const CLOUD = 'https://{cloud,stagingcloud,testcloud}.comfy.org'

const test = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    await mockWorkspace(page, workspace('personal', 'owner'), [])
    await mockBilling(page)
    await page.route(`${CLOUD}/api/features`, (route) =>
      route.fulfill({ headers: CORS, json: { open_on_cloud_enabled: true } })
    )
    await page.route(`${CLOUD}/api/cloud/compatibility`, (route) =>
      route.request().method() === 'OPTIONS'
        ? route.fulfill({
            status: 204,
            headers: {
              ...CORS,
              'access-control-allow-headers': '*',
              'access-control-allow-methods': 'POST'
            }
          })
        : route.fulfill({
            headers: CORS,
            json: { cloud: { missing_node_types: [], missing_models: [] } }
          })
    )
    await use(page)
  }
})

test.describe('Open on Cloud: linked inputs', { tag: '@auth' }, () => {
  test('checks the workflow and names the linked model input it could not check', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    await expect(page.getByTestId('cloud-button')).toBeVisible()
    await comfyPage.toast.closeToasts()
    await comfyPage.workflow.loadWorkflow(
      'openOnCloud/linked-model-and-sampler'
    )
    const compatibilityCheck = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        request.url().endsWith('/api/cloud/compatibility')
    )

    await page.getByTestId('cloud-button').click()

    await expect(
      page
        .getByTestId('run-on-cloud-card')
        .getByText(
          'Comfy Cloud has every node and model it could check. It could not check the models for these inputs: ckpt_name on CheckpointLoaderSimple. It opens in a new tab.'
        )
    ).toBeVisible()
    await expect(comfyPage.toast.visibleToasts).toHaveCount(0)
    expect((await compatibilityCheck).postDataJSON()).toEqual({
      node_types: [
        'DevToolsNodeWithV2ComboInput',
        'CheckpointLoaderSimple',
        'KSamplerSelect'
      ],
      models: []
    })
  })
})
