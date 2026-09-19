import { expect } from '@playwright/test'

import type { Asset } from '@comfyorg/ingest-types'
import { createCloudAssetsFixture } from '@e2e/fixtures/assetApiFixture'
import { loadWorkflowAndOpenErrorsTab } from '@e2e/fixtures/helpers/ErrorsTabHelper'
import { TestIds } from '@e2e/fixtures/selectors'

const WORKFLOW = 'missing/cloud_missing_model_two_unrelated_checkpoints'
const SELECTED_NODE_MODEL_NAME = 'selected_node_missing_checkpoint.safetensors'
const UNRELATED_NODE_MODEL_NAME =
  'unrelated_node_missing_checkpoint.safetensors'

const test = createCloudAssetsFixture([] as Asset[])

test.describe(
  'Errors tab - Missing model panel is scoped to the selected node',
  { tag: ['@cloud', '@vue-nodes', '@screenshot'] },
  () => {
    test.use({
      initialSettings: { 'Comfy.RightSidePanel.ShowErrorsTab': true }
    })

    // Reproduces: clicking an errored CheckpointLoaderSimple node to open the
    // Issues panel shows a missing-model row for an unrelated node instead of
    // (or alongside) the model that node actually references.
    test('shows only the selected node’s missing model, not an unrelated node’s', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(comfyPage, WORKFLOW)

      const missingModelsGroup = comfyPage.page.getByTestId(
        TestIds.dialogs.missingModelsGroup
      )
      await expect(
        missingModelsGroup.getByText(SELECTED_NODE_MODEL_NAME)
      ).toBeVisible()
      await expect(
        missingModelsGroup.getByText(UNRELATED_NODE_MODEL_NAME)
      ).toBeVisible()

      await comfyPage.vueNodes.selectNode('1')

      // Visual proof of the bug: after selecting node '1', the panel still
      // renders node '2's unrelated missing model alongside it, instead of
      // scoping the list down to the selected node's own missing model.
      await expect(
        missingModelsGroup.getByText(UNRELATED_NODE_MODEL_NAME)
      ).toBeVisible()
      await expect(missingModelsGroup).toHaveScreenshot(
        'missing-model-panel-unrelated-node-after-selection.png'
      )

      test.fail()
      await expect(
        missingModelsGroup.getByText(UNRELATED_NODE_MODEL_NAME)
      ).toBeHidden()
    })
  }
)
