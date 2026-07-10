import { expect, mergeTests } from '@playwright/test'

import type { Asset } from '@comfyorg/ingest-types'
import { assetApiFixture } from '@e2e/fixtures/assetApiFixture'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  MODEL_TYPE_CHECKPOINT_GGUF,
  MODEL_TYPE_CHECKPOINT_NESTED,
  MODEL_TYPE_CHECKPOINT_ROOT,
  MODEL_TYPE_CHECKPOINT_SCANNED,
  MODEL_TYPE_LORA,
  MODEL_TYPE_LORA_README,
  STABLE_CHECKPOINT
} from '@e2e/fixtures/data/assetFixtures'
import { withModels } from '@e2e/fixtures/helpers/AssetHelper'
import { dispatchApiCustomEvent } from '@e2e/fixtures/utils/dispatchApiEvent'
import type { ModelFolderInfo } from '@/platform/assets/schemas/assetSchema'

const test = mergeTests(comfyPageFixture, assetApiFixture)

// Deliberately not alphabetical: the sidebar must show folders in backend
// registration order, so 'loras' listed first must render first.
const REGISTERED_FOLDERS: ModelFolderInfo[] = [
  { name: 'loras', folders: ['/models/loras'], extensions: [] },
  {
    name: 'checkpoints',
    folders: ['/models/checkpoints'],
    extensions: ['.safetensors', '.gguf']
  }
]

const WALK_ASSETS: Asset[] = [
  MODEL_TYPE_CHECKPOINT_NESTED,
  MODEL_TYPE_CHECKPOINT_ROOT,
  MODEL_TYPE_CHECKPOINT_GGUF,
  MODEL_TYPE_LORA,
  MODEL_TYPE_LORA_README
]

test.use({
  initialSettings: {
    'Comfy.Assets.UseAssetAPI': true,
    'Comfy.ModelLibrary.UseAssetBrowser': false
  }
})

test.describe('Model library sidebar - asset mode', () => {
  test.beforeEach(async ({ comfyPage, assetApi }) => {
    assetApi.configure(withModels(WALK_ASSETS))
    await assetApi.mock()
    await comfyPage.modelLibrary.mockModelFolders(REGISTERED_FOLDERS)
    await comfyPage.setup()
    await comfyPage.featureFlags.setServerFlags({
      supports_model_type_tags: true
    })
    await comfyPage.menu.modelLibraryTab.open()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.modelLibrary.clearMocks()
  })

  test('Lists folders in backend registration order', async ({ comfyPage }) => {
    const tab = comfyPage.menu.modelLibraryTab

    await expect(tab.folderNodes.nth(0)).toContainText('loras')
    await expect(tab.folderNodes.nth(1)).toContainText('checkpoints')
  })

  test('Eager-loads models and drops the load-all button', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.modelLibraryTab

    await expect(tab.refreshButton).toBeVisible()
    await expect(tab.loadAllFoldersButton).toBeHidden()

    // Models render from the eager walk on expansion, with loader_path
    // subdirectories as nested folders.
    await tab.getFolderRowByLabel('checkpoints').click()
    await expect(tab.getLeafByLabel('v1-5-pruned-emaonly')).toBeVisible()
    await tab.getFolderRowByLabel('SDXL').click()
    await expect(tab.getLeafByLabel('sd_xl_base_1.0')).toBeVisible()
  })

  test('Applies registered extension allowlists verbatim and default-filters match-all folders', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.modelLibraryTab

    // checkpoints registers ['.safetensors', '.gguf'], so the .gguf model
    // shows even though the legacy fixed list would have hidden it.
    await tab.getFolderRowByLabel('checkpoints').click()
    await expect(tab.getLeafByLabel('flux_quantized.gguf')).toBeVisible()

    // loras is registered match-all (empty allowlist); the FE substitutes
    // the default model-extension list, hiding non-model noise.
    await tab.getFolderRowByLabel('loras').click()
    await expect(tab.getLeafByLabel('detail_enhancer_v1.2')).toBeVisible()
    await expect(tab.getLeafByLabel('README')).toBeHidden()
  })

  test('Refresh seeds a backend rescan', async ({ comfyPage, assetApi }) => {
    const tab = comfyPage.menu.modelLibraryTab

    await tab.refreshButton.click()

    await expect
      .poll(() =>
        assetApi
          .getMutations()
          .some(
            (mutation) =>
              mutation.method === 'POST' &&
              mutation.endpoint.endsWith('/assets/seed')
          )
      )
      .toBe(true)
  })

  test('Live-updates the tree when the scan fast-phase completes', async ({
    comfyPage,
    assetApi
  }) => {
    const tab = comfyPage.menu.modelLibraryTab

    await tab.getFolderRowByLabel('checkpoints').click()
    await expect(tab.getLeafByLabel('v1-5-pruned-emaonly')).toBeVisible()
    await expect(tab.getLeafByLabel('freshly_scanned')).toBeHidden()

    assetApi.configure(
      withModels([...WALK_ASSETS, MODEL_TYPE_CHECKPOINT_SCANNED])
    )
    await dispatchApiCustomEvent(comfyPage.page, 'assets.seed.fast_complete')

    await expect(tab.getLeafByLabel('freshly_scanned')).toBeVisible()
  })

  test('Active search results update when the scan fast-phase completes', async ({
    comfyPage,
    assetApi
  }) => {
    const tab = comfyPage.menu.modelLibraryTab

    // Search an existing model first: its result proves the eager load and
    // the debounced search pipeline have settled, so the later update can
    // only come from the scan event, not from a still-pending load.
    await tab.searchInput.fill('detail_enhancer')
    await expect(tab.getLeafByLabel('detail_enhancer_v1.2')).toBeVisible()

    await tab.searchInput.fill('freshly')
    await expect(tab.leafNodes).toHaveCount(0)

    assetApi.configure(
      withModels([...WALK_ASSETS, MODEL_TYPE_CHECKPOINT_SCANNED])
    )
    await dispatchApiCustomEvent(comfyPage.page, 'assets.seed.fast_complete')

    await expect(tab.getLeafByLabel('freshly_scanned')).toBeVisible()
  })

  test('Placing a model fills the loader with the category-relative loader path', async ({
    comfyPage
  }) => {
    await comfyPage.nodeOps.clearGraph()
    const tab = comfyPage.menu.modelLibraryTab

    await tab.getFolderRowByLabel('checkpoints').click()
    await tab.getFolderRowByLabel('SDXL').click()
    await tab.getLeafByLabel('sd_xl_base_1.0').click()

    // The ghost is armed; nothing is placed until the canvas is clicked.
    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount(), { timeout: 1000 })
      .toBe(0)

    const canvasBox = (await comfyPage.canvas.boundingBox())!
    await comfyPage.canvas.click({
      position: { x: canvasBox.width / 2, y: canvasBox.height / 2 }
    })

    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(1)

    const [loader] = await comfyPage.nodeOps.getNodeRefsByType(
      'CheckpointLoaderSimple'
    )
    expect(loader).toBeDefined()
    const widget = await loader.getWidgetByName('ckpt_name')
    expect(await widget.getValue()).toBe('SDXL/sd_xl_base_1.0.safetensors')
  })
})

test.describe('Model library sidebar - asset mode on bare-tag backends', () => {
  test.beforeEach(async ({ comfyPage, assetApi }) => {
    assetApi.configure(withModels([STABLE_CHECKPOINT]))
    await assetApi.mock()
    await comfyPage.modelLibrary.mockModelFolders([
      {
        name: 'checkpoints',
        folders: ['/models/checkpoints'],
        extensions: ['.safetensors']
      }
    ])
    await comfyPage.setup()
    // Force the capability off rather than omitting it: the real backend's
    // feature_flags handshake would otherwise decide which mode this tests.
    // Bare-tag backends bucket by bare tags and emit no loader_path, so
    // names fall back to the filename.
    await comfyPage.featureFlags.setServerFlags({
      supports_model_type_tags: false
    })
    await comfyPage.menu.modelLibraryTab.open()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.modelLibrary.clearMocks()
  })

  test('Buckets by bare tags and names leaves from the filename', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.modelLibraryTab

    await tab.getFolderRowByLabel('checkpoints').click()
    await expect(tab.getLeafByLabel('sd_xl_base_1.0')).toBeVisible()
  })
})
