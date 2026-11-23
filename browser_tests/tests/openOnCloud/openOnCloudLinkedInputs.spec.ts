import type {
  CheckCloudCompatibilityResponse,
  GetFeaturesResponse
} from '@comfyorg/ingest-types'
import type { Request } from '@playwright/test'
import { expect } from '@playwright/test'

import { localSignedOutFixture as test } from '@e2e/fixtures/localSignedOutFixture'

const CORS = { 'access-control-allow-origin': '*' }

test.describe('Open on Cloud: linked inputs', () => {
  test('checks the workflow and names the linked model input it could not check', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    const appOrigin = new URL(page.url()).origin
    const onCloud = (path: string) => (url: URL) =>
      url.origin !== appOrigin && url.pathname === path
    const checks: Request[] = []
    await page.route(onCloud('/api/features'), (route) =>
      route.fulfill({
        headers: CORS,
        json: { open_on_cloud_enabled: true } satisfies GetFeaturesResponse
      })
    )
    await page.route(onCloud('/api/cloud/compatibility'), (route) => {
      checks.push(route.request())
      return route.fulfill({
        headers: CORS,
        json: {
          cloud: { missing_node_types: [], missing_models: [] }
        } satisfies CheckCloudCompatibilityResponse
      })
    })
    await page.reload()
    await comfyPage.waitForAppReady()
    await comfyPage.workflow.loadWorkflow(
      'openOnCloud/linked-model-and-sampler'
    )

    await page.getByTestId('cloud-button').click()

    await expect(
      page
        .getByTestId('run-on-cloud-card')
        .getByText(
          'Comfy Cloud has every node and model this workflow sets directly. It could not check the models that come in through these links: ckpt_name on CheckpointLoaderSimple. It opens in a new tab.'
        )
    ).toBeVisible()
    await expect(comfyPage.toast.visibleToasts).toHaveCount(0)
    expect(checks).toHaveLength(1)
    expect(checks[0].postDataJSON()).toEqual({
      node_types: [
        'DevToolsNodeWithV2ComboInput',
        'CheckpointLoaderSimple',
        'KSamplerSelect'
      ],
      models: []
    })
  })
})
