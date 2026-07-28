import { expect, mergeTests } from '@playwright/test'

import type { Asset } from '@comfyorg/ingest-types'
import { assetApiFixture } from '@e2e/fixtures/assetApiFixture'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  MODEL_TYPE_CHECKPOINT_GGUF,
  MODEL_TYPE_CHECKPOINT_NESTED,
  MODEL_TYPE_CHECKPOINT_ORPHAN,
  MODEL_TYPE_CHECKPOINT_PRE_CUTOVER,
  MODEL_TYPE_CHECKPOINT_ROOT,
  MODEL_TYPE_CHECKPOINT_SCANNED,
  MODEL_TYPE_LORA,
  MODEL_TYPE_LORA_README,
  STABLE_CHECKPOINT
} from '@e2e/fixtures/data/assetFixtures'
import { withModels } from '@e2e/fixtures/helpers/AssetHelper'
import { dispatchApiCustomEvent } from '@e2e/fixtures/utils/dispatchApiEvent'
import { ASSETS_SEED_FAST_COMPLETE_EVENT } from '@/platform/assets/constants/assetEvents'
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
  MODEL_TYPE_CHECKPOINT_ORPHAN,
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
    await comfyPage.featureFlags.setServerFlagsPersistent({
      supports_model_type_tags: true
    })
    await comfyPage.menu.modelLibraryTab.open()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.modelLibrary.clearMocks()
  })

  test('Lists folders in backend registration order', async ({ comfyPage }) => {
    const tab = comfyPage.menu.modelLibraryTab

    // Ordered-array assertion instead of positional nth(): folderNodes also
    // matches nested folders and asset mode hides empty ones, so indexes are
    // not stable under fixture growth.
    await expect(tab.folderNodes).toContainText(['loras', 'checkpoints'])
  })

  test('Buckets assets only under their tagged category', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.modelLibraryTab

    // Only checkpoints is expanded; loras stays collapsed so its leaves are
    // unrendered. A visible lora leaf could then only mean it leaked into
    // the checkpoints bucket.
    await tab.getFolderRowByLabel('checkpoints').click()
    await expect(tab.getLeafByLabel('v1-5-pruned-emaonly')).toBeVisible()
    await expect(tab.getLeafByLabel('detail_enhancer_v1.2')).toHaveCount(0)
  })

  test('Never renders the model_type: tag literal', async ({ comfyPage }) => {
    const tab = comfyPage.menu.modelLibraryTab

    await tab.getFolderRowByLabel('loras').click()
    await expect(tab.getLeafByLabel('detail_enhancer_v1.2')).toBeVisible()
    await tab.getFolderRowByLabel('checkpoints').click()
    await tab.getFolderRowByLabel('SDXL').click()
    await expect(tab.getLeafByLabel('sd_xl_base_1.0')).toBeVisible()

    await expect(tab.modelTree.getByText(/model_type:/)).toHaveCount(0)
  })

  test('Hides orphan assets that have no loader path', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.modelLibraryTab

    // The sibling's visibility proves the checkpoints bucket rendered, so
    // the orphan's absence is a real skip rather than a pending load.
    await tab.getFolderRowByLabel('checkpoints').click()
    await expect(tab.getLeafByLabel('v1-5-pruned-emaonly')).toBeVisible()
    await expect(tab.getLeafByLabel('orphaned_checkpoint')).toHaveCount(0)
  })

  test('Eager-loads models and drops the load-all button', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.modelLibraryTab

    await expect(tab.refreshButton).toBeVisible()
    await expect(tab.loadAllFoldersButton).toHaveCount(0)

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
    // .gguf keeps its extension intentionally: only .safetensors is stripped by
    // the display-name formatter, so this is the correct label to assert.
    await expect(tab.getLeafByLabel('flux_quantized.gguf')).toBeVisible()

    // loras is registered match-all (empty allowlist); the FE substitutes
    // the default model-extension list, hiding non-model noise.
    await tab.getFolderRowByLabel('loras').click()
    await expect(tab.getLeafByLabel('detail_enhancer_v1.2')).toBeVisible()
    await expect(tab.getLeafByLabel('README')).toHaveCount(0)
  })

  test('Refresh seeds a backend rescan', async ({ comfyPage, assetApi }) => {
    const tab = comfyPage.menu.modelLibraryTab

    await tab.refreshButton.click()

    await expect
      .poll(
        () =>
          assetApi
            .getMutations()
            .find(
              (mutation) =>
                mutation.method === 'POST' &&
                mutation.endpoint.endsWith('/assets/seed')
            )?.body
      )
      .toEqual({ roots: ['models'] })
  })

  test('Live-updates the tree when the scan fast-phase completes', async ({
    comfyPage,
    assetApi
  }) => {
    const tab = comfyPage.menu.modelLibraryTab

    await tab.getFolderRowByLabel('checkpoints').click()
    await expect(tab.getLeafByLabel('v1-5-pruned-emaonly')).toBeVisible()
    await expect(tab.getLeafByLabel('freshly_scanned')).toHaveCount(0)

    assetApi.configure(
      withModels([...WALK_ASSETS, MODEL_TYPE_CHECKPOINT_SCANNED])
    )
    await dispatchApiCustomEvent(
      comfyPage.page,
      ASSETS_SEED_FAST_COMPLETE_EVENT
    )

    await expect(tab.getLeafByLabel('freshly_scanned')).toBeVisible()
  })

  // Distinct from the tree-update test above: this exercises the debounced
  // search pipeline specifically. The tree re-render and the search re-query
  // are separate reactive paths; removing this test would silently drop
  // coverage of the search update on scan completion.
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
    await dispatchApiCustomEvent(
      comfyPage.page,
      ASSETS_SEED_FAST_COMPLETE_EVENT
    )

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

    // The visible ghost preview marks arming as complete, so a zero node
    // count here proves nothing is placed until the canvas is clicked.
    const ghost = comfyPage.page.locator(
      '[data-node-id="preview-CheckpointLoaderSimple"]'
    )
    await expect(ghost).toBeVisible()
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

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
    expect(await widget.getValue()).toBe(
      MODEL_TYPE_CHECKPOINT_NESTED.loader_path
    )
  })
})

test.describe('Model library sidebar - asset mode when the walk fails', () => {
  test.beforeEach(async ({ comfyPage, assetApi }) => {
    // The models walk 500s before the sidebar's eager load ever reads it, so
    // no folder contents can resolve. The folder registration endpoint is
    // separate, so the panel still knows which folders exist.
    await assetApi.mockError(500)
    await comfyPage.modelLibrary.mockModelFolders(REGISTERED_FOLDERS)
    await comfyPage.setup()
    await comfyPage.featureFlags.setServerFlagsPersistent({
      supports_model_type_tags: true
    })
    await comfyPage.menu.modelLibraryTab.open()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.modelLibrary.clearMocks()
  })

  test('Degrades gracefully instead of hanging the panel', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.modelLibraryTab

    // The panel renders and stays interactive even though the eager load threw:
    // the tools and search box are usable rather than stuck on a load screen.
    await expect(tab.refreshButton).toBeVisible()
    await expect(tab.refreshButton).toBeEnabled()
    await expect(tab.searchInput).toBeEditable()

    // Registered folders still list from the folder endpoint; only their
    // contents are missing, so the tree shows folders but no model leaves.
    await expect(tab.getFolderRowByLabel('checkpoints')).toBeVisible()
    await expect(tab.leafNodes).toHaveCount(0)

    // Expanding a folder re-attempts the failing load; awaiting that
    // response proves the retry round-trip completed (and stayed failed)
    // before asserting the tree is still leaf-free, rather than asserting
    // against a tree that has not reloaded yet.
    const retriedWalk = comfyPage.page.waitForResponse(
      (response) =>
        response.url().includes('/api/assets') &&
        response.request().method() === 'GET'
    )
    await tab.getFolderRowByLabel('checkpoints').click()
    expect((await retriedWalk).status()).toBe(500)
    await expect(tab.leafNodes).toHaveCount(0)
  })
})

test.describe('Model library sidebar - asset mode before the loader_path cutover', () => {
  test.beforeEach(async ({ comfyPage, assetApi }) => {
    assetApi.configure(withModels([MODEL_TYPE_CHECKPOINT_PRE_CUTOVER]))
    await assetApi.mock()
    await comfyPage.modelLibrary.mockModelFolders(REGISTERED_FOLDERS)
    await comfyPage.setup()
    await comfyPage.featureFlags.setServerFlagsPersistent({
      supports_model_type_tags: true
    })
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.modelLibrary.clearMocks()
  })

  // A backend can report supports_model_type_tags before its loader_path
  // writer has run (the BE-4728 / cloud#5604 ordering): the walk then skips
  // every asset as unloadable, each folder loads empty, and asset mode hides
  // empty folders — the whole tree empties. This pins that cutover window so
  // the cross-repo ordering dependency fails visibly in CI instead of
  // silently blanking the sidebar.
  test('Empties the tree when no walked asset carries a loader path', async ({
    comfyPage
  }) => {
    const warnings: string[] = []
    comfyPage.page.on('console', (message) => {
      if (message.type() === 'warning') warnings.push(message.text())
    })

    await comfyPage.menu.modelLibraryTab.open()
    const tab = comfyPage.menu.modelLibraryTab

    // The skip warning proves the walk saw the asset and dropped it for
    // lacking loader_path; without it, an empty tree could also mean the
    // walk returned nothing and the test would pass vacuously.
    await expect
      .poll(() =>
        warnings.some((warning) => warning.includes('has no loader_path'))
      )
      .toBe(true)

    await expect(tab.folderNodes).toHaveCount(0)
    await expect(tab.leafNodes).toHaveCount(0)

    // Degrades to empty, not broken: the panel stays interactive.
    await expect(tab.refreshButton).toBeEnabled()
    await expect(tab.searchInput).toBeEditable()
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
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.modelLibrary.clearMocks()
  })

  // Bare-tag backends bucket by bare tags and emit no loader_path, so names
  // fall back to the filename.
  test('Buckets by bare tags and names leaves from the filename', async ({
    comfyPage
  }) => {
    // Force the capability off rather than omitting it: the real backend's
    // feature_flags handshake would otherwise decide which mode this tests.
    await comfyPage.featureFlags.setServerFlagsPersistent({
      supports_model_type_tags: false
    })
    await comfyPage.menu.modelLibraryTab.open()
    const tab = comfyPage.menu.modelLibraryTab

    await tab.getFolderRowByLabel('checkpoints').click()
    await expect(tab.getLeafByLabel('sd_xl_base_1.0')).toBeVisible()
  })

  // Distinct from forcing the flag to false: stripping the key exercises the
  // client's own default for an ABSENT capability flag. Legacy bare-tag
  // bucketing must remain that default — if it ever flipped to model_type
  // mode, this bare-tagged asset would be dropped and the leaf would vanish.
  test('Defaults to bare-tag bucketing when the capability flag is absent', async ({
    comfyPage
  }) => {
    await comfyPage.featureFlags.clearServerFlagsPersistent([
      'supports_model_type_tags'
    ])
    await comfyPage.menu.modelLibraryTab.open()
    const tab = comfyPage.menu.modelLibraryTab

    await tab.getFolderRowByLabel('checkpoints').click()
    await expect(tab.getLeafByLabel('sd_xl_base_1.0')).toBeVisible()
  })
})
