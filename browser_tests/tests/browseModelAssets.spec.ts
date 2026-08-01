import { expect } from '@playwright/test'

import type {
  Asset,
  GetModelFoldersResponse,
  ListAssetsResponse
} from '@comfyorg/ingest-types'
import { createCloudAssetsFixture } from '@e2e/fixtures/assetApiFixture'
import { cloudAppFixture, waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import { STABLE_CHECKPOINT } from '@e2e/fixtures/data/assetFixtures'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

const CLOUD_ASSETS: Asset[] = [STABLE_CHECKPOINT]

const test = createCloudAssetsFixture(CLOUD_ASSETS)
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

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

cloudAppFixture.describe(
  'Import model dialog layout',
  { tag: '@cloud' },
  () => {
    cloudAppFixture(
      'uses one scroll region on a short viewport',
      async ({ page }) => {
        const features = {
          model_upload_button_enabled: true,
          private_models_enabled: true
        } satisfies RemoteConfig
        const settings = {
          'Comfy.Assets.UseAssetAPI': true,
          'Comfy.TutorialCompleted': true
        }
        const assetsResponse = {
          assets: [],
          total: 0,
          has_more: false
        } satisfies ListAssetsResponse
        const modelFolders = [
          { name: 'checkpoints', folders: [] }
        ] satisfies GetModelFoldersResponse

        await page.setViewportSize({ width: 1280, height: 420 })
        await mockCloudBoot(page, { features, settings })
        await bootCloud(page)
        await page.route(/\/api\/assets(?:\?.*)?$/, (route) =>
          route.fulfill(jsonRoute(assetsResponse))
        )
        await page.route('**/api/experiment/models', (route) =>
          route.fulfill(jsonRoute(modelFolders))
        )

        await page.goto(APP_URL)
        await waitForCloudApp(page)
        await page.evaluate(() =>
          window.app!.extensionManager.command.execute(
            'Comfy.BrowseModelAssets'
          )
        )
        await page.locator('[data-attr="upload-model-button"]').click()

        const dialog = page.getByRole('dialog', { name: /Import a model/ })
        const cancelButton = dialog.locator(
          '[data-attr="upload-model-step1-cancel-button"]'
        )
        await expect(dialog).toBeVisible()
        await expect(cancelButton).toBeVisible()

        const metrics = await dialog.evaluate((element) => {
          const scrollRegions = Array.from(
            element.querySelectorAll<HTMLElement>('*')
          ).filter((candidate) => {
            const style = getComputedStyle(candidate)
            return [style.overflowX, style.overflowY].some(
              (overflow) => overflow === 'auto' || overflow === 'scroll'
            )
          })
          const dialogRect = element.getBoundingClientRect()

          return {
            scrollRegionCount: scrollRegions.length,
            dialogBottom: dialogRect.bottom,
            viewportHeight: window.innerHeight
          }
        })

        expect(metrics.scrollRegionCount).toBe(1)
        expect(metrics.dialogBottom).toBeLessThanOrEqual(metrics.viewportHeight)

        const cancelButtonRect = await cancelButton.boundingBox()
        expect(cancelButtonRect).not.toBeNull()
        expect(
          cancelButtonRect!.y + cancelButtonRect!.height
        ).toBeLessThanOrEqual(metrics.viewportHeight)
      }
    )
  }
)
