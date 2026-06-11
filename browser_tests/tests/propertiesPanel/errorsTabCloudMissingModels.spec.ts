import { expect } from '@playwright/test'

import type { Asset } from '@comfyorg/ingest-types'
import {
  countAssetRequestsByTag,
  createCloudAssetsFixture
} from '@e2e/fixtures/assetApiFixture'
import { loadWorkflowAndOpenErrorsTab } from '@e2e/fixtures/helpers/ErrorsTabHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

const WORKFLOW = 'missing/nested_subgraph_installed_model'
const IMPORT_SECTIONS_WORKFLOW = 'missing/cloud_missing_model_import_sections'
const OUTER_SUBGRAPH_NODE_ID = '205'
const LOTUS_MODEL_NAME = 'lotus-depth-d-v1-1.safetensors'
const CLOUD_IMPORTABLE_MODEL_NAME = 'cloud_importable_model.safetensors'
const CLOUD_UNKNOWN_MODEL_NAME = 'cloud_unknown_model.safetensors'

const LOTUS_DIFFUSION_MODEL: Asset & { hash?: string } = {
  id: 'test-lotus-depth-d-v1-1',
  name: LOTUS_MODEL_NAME,
  hash: 'blake3:0000000000000000000000000000000000000000000000000000000000000203',
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
      await comfyPage.featureFlags.setServerFlags({
        model_upload_button_enabled: true,
        private_models_enabled: true
      })
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
        .poll(
          () => countAssetRequestsByTag(cloudAssetRequests, 'diffusion_models'),
          { timeout: 10_000 }
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

      await expect(errorsTab).toBeHidden()
    })

    test('separates importable cloud models from unsupported rows', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(comfyPage, IMPORT_SECTIONS_WORKFLOW)

      const missingModelsGroup = comfyPage.page.getByTestId(
        TestIds.dialogs.missingModelsGroup
      )
      const importableRows = missingModelsGroup.getByTestId(
        TestIds.dialogs.missingModelImportableRows
      )
      const unsupportedSection = missingModelsGroup.getByTestId(
        TestIds.dialogs.missingModelUnsupportedSection
      )

      await expect(
        importableRows.getByRole('button', {
          name: CLOUD_IMPORTABLE_MODEL_NAME,
          exact: true
        })
      ).toBeVisible()
      await expect(
        importableRows.getByTestId(TestIds.dialogs.missingModelImport)
      ).toBeVisible()

      await expect(unsupportedSection).toBeVisible()
      await expect(
        unsupportedSection.getByText('Import Not Supported')
      ).toBeVisible()
      await expect(
        unsupportedSection.getByText(
          /Nodes that reference the models below do not support imported models/
        )
      ).toBeVisible()
      await expect(
        unsupportedSection.getByText(CLOUD_UNKNOWN_MODEL_NAME)
      ).toBeVisible()
      await expect(
        unsupportedSection.getByText('Unknown', { exact: true })
      ).toBeVisible()
      await expect(
        unsupportedSection.getByRole('button', {
          name: 'Load Image',
          exact: true
        })
      ).toBeVisible()
      await expect(
        unsupportedSection.getByTestId(TestIds.dialogs.missingModelImport)
      ).toHaveCount(0)
    })

    test('opens cloud import with missing-model replacement context', async ({
      comfyPage
    }) => {
      await comfyPage.modelLibrary.mockModelFolders([
        { name: 'checkpoints', folders: [] }
      ])
      await comfyPage.page.route('**/assets/remote-metadata?**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content_length: 1024,
            final_url:
              'https://huggingface.co/comfy/test/resolve/main/replacement.safetensors',
            content_type: 'application/octet-stream',
            filename: 'replacement.safetensors',
            tags: ['loras']
          })
        })
      )
      await loadWorkflowAndOpenErrorsTab(comfyPage, IMPORT_SECTIONS_WORKFLOW)

      const missingModelsGroup = comfyPage.page.getByTestId(
        TestIds.dialogs.missingModelsGroup
      )
      await missingModelsGroup
        .getByTestId(TestIds.dialogs.missingModelImport)
        .click()

      const urlInput = comfyPage.page.locator(
        '[data-attr="upload-model-step1-url-input"]'
      )
      await expect(urlInput).toBeVisible()
      await urlInput.fill(
        'https://huggingface.co/comfy/test/resolve/main/replacement.safetensors'
      )
      await comfyPage.page
        .locator('[data-attr="upload-model-step1-continue-button"]')
        .click()

      const uploadDialog = comfyPage.page.getByRole('dialog', {
        name: /Import a model/
      })
      await expect(
        uploadDialog.getByText(
          `This import will replace ${CLOUD_IMPORTABLE_MODEL_NAME} in:`
        )
      ).toBeVisible()
      await expect(uploadDialog.getByText('Load Checkpoint')).toBeVisible()
      await expect(uploadDialog.getByText('- ckpt_name')).toBeVisible()
      await expect(
        uploadDialog.getByText(
          /Locked to (Checkpoints|checkpoints) for this missing model/
        )
      ).toBeVisible()
    })
  }
)
