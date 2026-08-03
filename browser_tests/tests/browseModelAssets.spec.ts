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

import type {
  AssetMetadata,
  AsyncUploadResponse
} from '@/platform/assets/schemas/assetSchema'
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
      'uses one scroll region throughout import on a short viewport',
      async ({ page }) => {
        const filename =
          'Alissonerdx__CharacterSheet__QuadView_krea2_v1.safetensors'
        const sourceUrl = `https://huggingface.co/comfy/test/resolve/main/${filename}`
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
        const metadata = {
          content_length: 1024,
          final_url: sourceUrl,
          content_type: 'application/octet-stream',
          filename,
          tags: ['checkpoints']
        } satisfies AssetMetadata
        const downloadTask = {
          task_id: 'download-task-001',
          status: 'created',
          message: 'Queued'
        } satisfies Extract<AsyncUploadResponse, { type: 'async' }>['task']

        await page.setViewportSize({ width: 1280, height: 420 })
        await mockCloudBoot(page, { features, settings })
        await bootCloud(page)
        await page.route(/\/api\/assets(?:\?.*)?$/, (route) =>
          route.fulfill(jsonRoute(assetsResponse))
        )
        await page.route('**/api/experiment/models', (route) =>
          route.fulfill(jsonRoute(modelFolders))
        )
        await page.route(/\/assets\/remote-metadata(?:\?.*)?$/, (route) =>
          route.fulfill(jsonRoute(metadata))
        )
        await page.route('**/assets/download', (route) =>
          route.fulfill({ ...jsonRoute(downloadTask), status: 202 })
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
          const panel = element.querySelector('.upload-model-dialog')
          const body = panel?.parentElement
          const dialogRect = element.getBoundingClientRect()
          const panelRect = panel?.getBoundingClientRect()
          const bodyRect = body?.getBoundingClientRect()

          return {
            dialogBottom: dialogRect.bottom,
            panelLeft: panelRect?.left,
            panelRight: panelRect?.right,
            bodyLeft: bodyRect?.left,
            bodyRight: bodyRect?.right,
            viewportHeight: window.innerHeight
          }
        })

        expect(metrics.dialogBottom).toBeLessThanOrEqual(metrics.viewportHeight)
        expect(metrics.panelLeft).toBeGreaterThanOrEqual(metrics.bodyLeft!)
        expect(metrics.panelRight).toBeLessThanOrEqual(metrics.bodyRight!)

        const cancelButtonRect = await cancelButton.boundingBox()
        expect(cancelButtonRect).not.toBeNull()
        expect(
          cancelButtonRect!.y + cancelButtonRect!.height
        ).toBeLessThanOrEqual(metrics.viewportHeight)

        await dialog
          .locator('[data-attr="upload-model-step1-url-input"]')
          .fill(sourceUrl)
        await dialog
          .locator('[data-attr="upload-model-step1-continue-button"]')
          .click()
        await dialog
          .locator('[data-attr="upload-model-step2-confirm-button"]')
          .click()
        await expect(dialog.getByText('Download started')).toBeVisible()
        await expect(dialog.getByText(filename)).toBeVisible()

        const finishButton = dialog.locator(
          '[data-attr="upload-model-step3-finish-button"]'
        )
        await expect(finishButton).toBeVisible()

        const processingMetrics = await dialog.evaluate((element) => {
          const candidates = new Set<Element>([
            element,
            ...element.querySelectorAll('*')
          ])
          let ancestor = element.parentElement
          while (ancestor) {
            candidates.add(ancestor)
            ancestor = ancestor.parentElement
          }
          if (document.scrollingElement) {
            candidates.add(document.scrollingElement)
          }

          const panel = element.querySelector('.upload-model-dialog')
          const body = panel?.parentElement
          const panelRect = panel?.getBoundingClientRect()
          const bodyRect = body?.getBoundingClientRect()

          return {
            overflowingRegionCount: [...candidates].filter((candidate) => {
              const style = getComputedStyle(candidate)
              return (
                ((style.overflowX === 'auto' || style.overflowX === 'scroll') &&
                  candidate.scrollWidth > candidate.clientWidth) ||
                ((style.overflowY === 'auto' || style.overflowY === 'scroll') &&
                  candidate.scrollHeight > candidate.clientHeight)
              )
            }).length,
            panelLeft: panelRect?.left,
            panelRight: panelRect?.right,
            bodyLeft: bodyRect?.left,
            bodyRight: bodyRect?.right
          }
        })

        expect(processingMetrics.overflowingRegionCount).toBe(0)
        expect(processingMetrics.panelLeft).toBeGreaterThanOrEqual(
          processingMetrics.bodyLeft!
        )
        expect(processingMetrics.panelRight).toBeLessThanOrEqual(
          processingMetrics.bodyRight!
        )

        const bodyRect = await dialog
          .locator('.upload-model-dialog')
          .evaluate((panel) => {
            const rect = panel.parentElement!.getBoundingClientRect()
            return { top: rect.top, bottom: rect.bottom }
          })
        const finishButtonRect = await finishButton.boundingBox()
        expect(finishButtonRect).not.toBeNull()
        expect(finishButtonRect!.y).toBeGreaterThanOrEqual(bodyRect.top)
        expect(
          finishButtonRect!.y + finishButtonRect!.height
        ).toBeLessThanOrEqual(bodyRect.bottom)
      }
    )
  }
)
