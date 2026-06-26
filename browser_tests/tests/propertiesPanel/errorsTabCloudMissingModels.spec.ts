import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type {
  Asset,
  AssetCreated,
  ListAssetsResponse
} from '@comfyorg/ingest-types'
import {
  countAssetRequestsByTag,
  createCloudAssetsFixture
} from '@e2e/fixtures/assetApiFixture'
import {
  cleanupFakeModel,
  loadWorkflowAndOpenErrorsTab
} from '@e2e/fixtures/helpers/ErrorsTabHelper'
import {
  NESTED_PROMOTED_MISSING_MODEL_WORKFLOW,
  expectNoMissingModelUi,
  loadPromotedMissingModelAndOpenErrorsTab,
  selectLegacyPromotedAssetModel,
  selectSectionAssetPromotedModel,
  selectVueAssetPromotedModel
} from '@e2e/fixtures/utils/promotedMissingModel'
import { TestIds } from '@e2e/fixtures/selectors'
import { toNodeId } from '@/types/nodeId'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

import type { AssetMetadata } from '@/platform/assets/schemas/assetSchema'

const WORKFLOW = 'missing/nested_subgraph_installed_model'
const IMPORT_SECTIONS_WORKFLOW = 'missing/cloud_missing_model_import_sections'
const OUTER_SUBGRAPH_NODE_ID = '205'
const LOTUS_MODEL_NAME = 'lotus-depth-d-v1-1.safetensors'
const FAKE_MODEL_NAME = 'fake_model.safetensors'
const RESOLVED_PROMOTED_MODEL_NAME = 'resolved_model.safetensors'
const CLOUD_IMPORTABLE_MODEL_NAME = 'cloud_importable_model.safetensors'
const CLOUD_UNKNOWN_MODEL_NAME = 'cloud_unknown_model.safetensors'
const CLOUD_IMPORTED_CANONICAL_MODEL_NAME =
  'models/checkpoints/cloud_importable_model.safetensors'

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

const EXISTING_CLOUD_IMPORTABLE_MODEL: Asset & { hash?: string } = {
  id: 'test-existing-cloud-importable-model',
  name: 'asset-record-display-name.safetensors',
  hash: 'blake3:0000000000000000000000000000000000000000000000000000000000000204',
  size: 2_048,
  mime_type: 'application/octet-stream',
  tags: ['models', 'checkpoints'],
  created_at: '2026-05-05T00:00:00Z',
  updated_at: '2026-05-05T00:00:00Z',
  last_access_time: '2026-05-05T00:00:00Z',
  user_metadata: {
    filename: CLOUD_IMPORTED_CANONICAL_MODEL_NAME
  }
}

const RESOLVED_PROMOTED_MODEL_ASSET: Asset & { hash?: string } = {
  id: 'test-resolved-promoted-model',
  name: RESOLVED_PROMOTED_MODEL_NAME,
  hash: 'blake3:0000000000000000000000000000000000000000000000000000000000000205',
  size: 1_024,
  mime_type: 'application/octet-stream',
  tags: ['models', 'checkpoints'],
  created_at: '2026-05-05T00:00:00Z',
  updated_at: '2026-05-05T00:00:00Z',
  last_access_time: '2026-05-05T00:00:00Z',
  user_metadata: {
    filename: RESOLVED_PROMOTED_MODEL_NAME
  }
}

const test = createCloudAssetsFixture([LOTUS_DIFFUSION_MODEL])
const promotedModelTest = createCloudAssetsFixture([
  RESOLVED_PROMOTED_MODEL_ASSET
])

function getRequestedIncludeTags(requestUrl: string): string[] {
  return (
    new URL(requestUrl).searchParams
      .get('include_tags')
      ?.split(',')
      .map((tag) => tag.trim())
      .filter(Boolean) ?? []
  )
}

function filterAssetsByRequest(
  assets: ReadonlyArray<Asset>,
  requestUrl: string
): Asset[] {
  const includeTags = getRequestedIncludeTags(requestUrl)
  return includeTags.length
    ? assets.filter((asset) =>
        includeTags.every((tag) => asset.tags?.includes(tag))
      )
    : [...assets]
}

async function enableMissingModelImportFeatures(page: Page): Promise<void> {
  await page.evaluate(() => {
    const api = window.app!.api
    api.serverFeatureFlags.value = {
      ...api.serverFeatureFlags.value,
      model_upload_button_enabled: true,
      private_models_enabled: true
    }
  })
}

test.describe(
  'Errors tab - Cloud missing models',
  { tag: ['@cloud', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await enableMissingModelImportFeatures(comfyPage.page)
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
      await comfyPage.page.route('**/assets/remote-metadata?**', (route) => {
        const response: AssetMetadata = {
          content_length: 1024,
          final_url:
            'https://huggingface.co/comfy/test/resolve/main/replacement.safetensors',
          content_type: 'application/octet-stream',
          filename: 'replacement.safetensors',
          tags: ['loras']
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response)
        })
      })
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

    test('uses the synced asset filename when applying an already imported cloud model', async ({
      comfyPage
    }) => {
      let isImportedAssetAvailable = false
      const visibleAssets = () =>
        isImportedAssetAvailable
          ? [LOTUS_DIFFUSION_MODEL, EXISTING_CLOUD_IMPORTABLE_MODEL]
          : [LOTUS_DIFFUSION_MODEL]

      await comfyPage.modelLibrary.mockModelFolders([
        { name: 'checkpoints', folders: [] }
      ])
      await comfyPage.page.route(/\/api\/assets(?:\?.*)?$/, (route) => {
        const assets = filterAssetsByRequest(
          visibleAssets(),
          route.request().url()
        )
        const response: ListAssetsResponse = {
          assets,
          total: assets.length,
          has_more: false
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response)
        })
      })
      await comfyPage.page.route('**/assets/remote-metadata?**', (route) => {
        const response: AssetMetadata = {
          content_length: 2048,
          final_url:
            'https://huggingface.co/comfy/test/resolve/main/cloud_importable_model.safetensors',
          content_type: 'application/octet-stream',
          filename: CLOUD_IMPORTABLE_MODEL_NAME,
          tags: ['checkpoints']
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response)
        })
      })
      await comfyPage.page.route('**/assets/download', (route) => {
        isImportedAssetAvailable = true
        const response: AssetCreated = {
          ...EXISTING_CLOUD_IMPORTABLE_MODEL,
          created_new: false
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response)
        })
      })

      await loadWorkflowAndOpenErrorsTab(comfyPage, IMPORT_SECTIONS_WORKFLOW)

      const missingModelsGroup = comfyPage.page.getByTestId(
        TestIds.dialogs.missingModelsGroup
      )
      await missingModelsGroup
        .getByTestId(TestIds.dialogs.missingModelImport)
        .click()

      const uploadDialog = comfyPage.page.getByRole('dialog', {
        name: /Import a model/
      })
      const urlInput = uploadDialog.locator(
        '[data-attr="upload-model-step1-url-input"]'
      )
      await urlInput.fill(
        'https://huggingface.co/comfy/test/resolve/main/cloud_importable_model.safetensors'
      )
      await uploadDialog
        .locator('[data-attr="upload-model-step1-continue-button"]')
        .click()
      await expect(
        uploadDialog.getByText(
          `This import will replace ${CLOUD_IMPORTABLE_MODEL_NAME} in:`
        )
      ).toBeVisible()

      await uploadDialog
        .locator('[data-attr="upload-model-step2-confirm-button"]')
        .click()

      await expect
        .poll(() =>
          comfyPage.page.evaluate((nodeId) => {
            const node = window.app!.graph.getNodeById(nodeId)
            return node?.widgets?.find((widget) => widget.name === 'ckpt_name')
              ?.value
          }, toNodeId(1))
        )
        .toBe(CLOUD_IMPORTED_CANONICAL_MODEL_NAME)
    })
  }
)

promotedModelTest.describe(
  'Errors tab - Cloud promoted subgraph missing models',
  { tag: '@cloud' },
  () => {
    promotedModelTest.beforeEach(async ({ comfyPage }) => {
      await cleanupFakeModel(comfyPage)
      await comfyPage.settings.setSetting('Comfy.Assets.UseAssetAPI', true)
      await comfyPage.settings.setSetting(
        'Comfy.RightSidePanel.ShowErrorsTab',
        true
      )
    })

    promotedModelTest.afterEach(async ({ comfyPage }) => {
      await cleanupFakeModel(comfyPage)
    })

    promotedModelTest(
      'Changing a Cloud Vue promoted asset widget clears a nested subgraph error',
      { tag: ['@vue-nodes', '@widget', '@subgraph'] },
      async ({ comfyPage }) => {
        await loadPromotedMissingModelAndOpenErrorsTab(
          comfyPage,
          NESTED_PROMOTED_MISSING_MODEL_WORKFLOW,
          FAKE_MODEL_NAME
        )

        await selectVueAssetPromotedModel(
          comfyPage,
          NESTED_PROMOTED_MISSING_MODEL_WORKFLOW,
          FAKE_MODEL_NAME,
          RESOLVED_PROMOTED_MODEL_NAME
        )

        await expectNoMissingModelUi(comfyPage)
      }
    )

    promotedModelTest(
      'Changing a Cloud Vue promoted asset from the Parameters tab clears a nested subgraph error',
      { tag: ['@vue-nodes', '@widget', '@subgraph'] },
      async ({ comfyPage }) => {
        await loadPromotedMissingModelAndOpenErrorsTab(
          comfyPage,
          NESTED_PROMOTED_MISSING_MODEL_WORKFLOW,
          FAKE_MODEL_NAME
        )

        await selectSectionAssetPromotedModel(
          comfyPage,
          NESTED_PROMOTED_MISSING_MODEL_WORKFLOW,
          FAKE_MODEL_NAME,
          RESOLVED_PROMOTED_MODEL_NAME
        )

        await expectNoMissingModelUi(comfyPage)
      }
    )

    promotedModelTest(
      'Changing a Cloud legacy promoted asset clears a nested subgraph error',
      { tag: ['@canvas', '@widget', '@subgraph'] },
      async ({ comfyPage }) => {
        await loadPromotedMissingModelAndOpenErrorsTab(
          comfyPage,
          NESTED_PROMOTED_MISSING_MODEL_WORKFLOW,
          FAKE_MODEL_NAME
        )

        await selectLegacyPromotedAssetModel(
          comfyPage,
          NESTED_PROMOTED_MISSING_MODEL_WORKFLOW,
          RESOLVED_PROMOTED_MODEL_ASSET.id
        )

        await expectNoMissingModelUi(comfyPage)
      }
    )
  }
)
