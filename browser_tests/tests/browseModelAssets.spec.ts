import { expect } from '@playwright/test'

import type { Asset } from '@comfyorg/ingest-types'
import { createCloudAssetsFixture } from '@e2e/fixtures/assetApiFixture'
import { STABLE_CHECKPOINT } from '@e2e/fixtures/data/assetFixtures'

const CLOUD_ASSETS: Asset[] = [STABLE_CHECKPOINT]

const test = createCloudAssetsFixture(CLOUD_ASSETS)

test.describe('Browse Model Assets - Use button', { tag: '@cloud' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Assets.UseAssetAPI', true)
    await comfyPage.nodeOps.clearGraph()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.nodeOps.clearGraph()
  })

  test('Use button ghost-places a loader populated with the model', async ({
    comfyPage
  }) => {
    await comfyPage.command.executeCommand('Comfy.BrowseModelAssets')

    const modal = comfyPage.page.locator(
      '[data-component-id="AssetBrowserModal"]'
    )
    await expect(modal).toBeVisible()

    const card = comfyPage.page.locator(
      `[data-component-id="AssetCard"][data-asset-id="${STABLE_CHECKPOINT.id}"]`
    )
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: 'Use' }).click()

    // Dialog closes and the ghost is armed; the node is not placed until the
    // user clicks the canvas.
    await expect(modal).toBeHidden()
    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount(), { timeout: 1000 })
      .toBe(0)

    const canvasBox = (await comfyPage.canvas.boundingBox())!
    await comfyPage.canvas.click({
      position: { x: canvasBox.width / 2, y: canvasBox.height / 2 }
    })

    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(1)
    await expect
      .poll(() => comfyPage.nodeOps.getSelectedGraphNodesCount())
      .toBe(1)

    const [loader] = await comfyPage.nodeOps.getNodeRefsByType(
      'CheckpointLoaderSimple'
    )
    expect(loader).toBeDefined()
    const widget = await loader.getWidgetByName('ckpt_name')
    expect(await widget.getValue()).toBe(STABLE_CHECKPOINT.name)
  })
})
