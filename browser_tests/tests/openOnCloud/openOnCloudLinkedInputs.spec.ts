import type {
  CheckCloudCompatibilityResponse,
  GetFeaturesResponse
} from '@comfyorg/ingest-types'
import { expect } from '@playwright/test'

import { mockDeployMedia } from '@e2e/fixtures/deployToComfyApiFixture'
import { localSignedOutFixture } from '@e2e/fixtures/localSignedOutFixture'

const CORS = { 'access-control-allow-origin': '*' }

function onCloud(path: string) {
  return (url: URL) => url.protocol === 'https:' && url.pathname === path
}

const test = localSignedOutFixture.extend({
  page: async ({ page }, use) => {
    await mockDeployMedia(page)
    await page.route(onCloud('/api/features'), (route) =>
      route.fulfill({
        headers: CORS,
        json: { open_on_cloud_enabled: true } satisfies GetFeaturesResponse
      })
    )
    await page.route(onCloud('/api/cloud/compatibility'), (route) =>
      route.fulfill({
        headers: CORS,
        json: {
          cloud: { missing_node_types: [], missing_models: [] }
        } satisfies CheckCloudCompatibilityResponse
      })
    )
    await use(page)
  }
})

test.describe('Open on Cloud: linked inputs', () => {
  test('checks the workflow and names the linked model input it could not check', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    await comfyPage.workflow.loadWorkflow(
      'openOnCloud/linked-model-and-sampler'
    )
    const compatibilityCheck = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        request.url().endsWith('/api/cloud/compatibility')
    )

    await comfyPage.actionbar.checkCloudCompatibility()

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
