import { expect } from '@playwright/test'

import type { Asset } from '@comfyorg/ingest-types'
import {
  countAssetRequestsByTag,
  createCloudAssetsFixture
} from '@e2e/fixtures/assetApiFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

const WORKFLOW = 'missing/nested_subgraph_installed_model'
const OUTER_SUBGRAPH_NODE_ID = '205'
const LOTUS_MODEL_NAME = 'lotus-depth-d-v1-1.safetensors'

const LOTUS_DIFFUSION_MODEL: Asset = {
  id: 'test-lotus-depth-d-v1-1',
  name: LOTUS_MODEL_NAME,
  asset_hash:
    'blake3:0000000000000000000000000000000000000000000000000000000000000203',
  size: 1_024,
  mime_type: 'application/octet-stream',
  tags: ['models', 'diffusion_models'],
  created_at: '2026-05-05T00:00:00Z',
  updated_at: '2026-05-05T00:00:00Z',
  last_access_time: '2026-05-05T00:00:00Z',
  user_metadata: {
    filename: LOTUS_MODEL_NAME
  }
}

const test = createCloudAssetsFixture([LOTUS_DIFFUSION_MODEL])

test.describe(
  'Errors tab - Cloud missing models',
  { tag: ['@cloud', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.RightSidePanel.ShowErrorsTab',
        true
      )
    })

    test('keeps installed models resolved after returning from a nested subgraph', async ({
      cloudAssetRequests,
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)

      const panel = new PropertiesPanelHelper(comfyPage.page)
      const errorOverlay = comfyPage.page.getByTestId(
        TestIds.dialogs.errorOverlay
      )
      const errorsTab = panel.root.getByTestId(
        TestIds.propertiesPanel.errorsTab
      )

      await expect
        .poll(() =>
          countAssetRequestsByTag(cloudAssetRequests, 'diffusion_models')
        )
        .toBeGreaterThan(0)
      await expect(errorOverlay).toBeHidden()
      await panel.open(comfyPage.actionbar.propertiesButton)
      await expect(errorsTab).toBeHidden()
      await panel.close()

      await comfyPage.vueNodes.enterSubgraph(OUTER_SUBGRAPH_NODE_ID)
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)
      await expect(errorOverlay).toBeHidden()

      const requestCountBeforeRootReturn = countAssetRequestsByTag(
        cloudAssetRequests,
        'diffusion_models'
      )

      await comfyPage.subgraph.exitViaBreadcrumb()
      await panel.open(comfyPage.actionbar.propertiesButton)

      await expect
        .poll(
          () =>
            countAssetRequestsByTag(cloudAssetRequests, 'diffusion_models') >
            requestCountBeforeRootReturn,
          { timeout: 10_000 }
        )
        .toBe(true)

      test.fail(
        true,
        'Root return currently replays nested subgraph container model widgets as missing in Cloud. Remove this annotation when the replay scan skips nested subgraph containers.'
      )

      await expect(errorsTab).toBeHidden()
    })
  }
)
