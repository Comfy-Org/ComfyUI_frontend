/**
 * FE-1425: a Load Image node populated from the assets sidebar's Generated tab
 * holds an `[output]`-annotated widget value. The preview must resolve it to
 * the output directory instead of asking for the annotation as part of the
 * filename under `type=input`, which 404s and renders "Image failed to load".
 */
import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { createMockJob } from '@e2e/fixtures/helpers/AssetsHelper'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

test.describe('Load Image annotated widget value', { tag: '@widget' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Sidebar'
    )
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({})
  })

  test(
    'keeps a Generated asset preview loaded through execution and workflow switches',
    { tag: '@slow' },
    async ({ comfyPage, getWebSocket }) => {
      test.setTimeout(30_000)
      await comfyPage.assets.mockOutputHistory([
        createMockJob({
          id: 'generated-image',
          preview_output: {
            filename: 'generated.png',
            subfolder: 'runs/2026',
            type: 'output',
            nodeId: '1',
            mediaType: 'images'
          }
        })
      ])

      await comfyPage.page.route('**/api/view?*', async (route) => {
        const params = new URL(route.request().url()).searchParams
        const isGeneratedImage =
          params.get('type') === 'output' &&
          params.get('filename') === 'generated.png' &&
          params.get('subfolder') === 'runs/2026'

        await route.fulfill(
          isGeneratedImage
            ? { path: comfyPage.assetPath('image64x64.webp') }
            : { status: 404 }
        )
      })

      await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
      await comfyPage.vueNodes.waitForNodes()
      const loadImageNode =
        await comfyPage.vueNodes.getFixtureByTitle('Load Image')

      const { assetsTab } = comfyPage.menu
      await assetsTab.open()
      const generatedAsset = assetsTab.assetCards.filter({
        has: comfyPage.page.getByRole('button', {
          name: 'generated.png - image asset'
        })
      })
      await expect(generatedAsset).toBeVisible()
      const dataTransfer = await comfyPage.page.evaluateHandle(
        () => new DataTransfer()
      )
      await generatedAsset.dispatchEvent('dragstart', { dataTransfer })
      await loadImageNode.root.dispatchEvent('dragover', { dataTransfer })
      await loadImageNode.root.dispatchEvent('drop', { dataTransfer })
      await generatedAsset.dispatchEvent('dragend', { dataTransfer })
      await dataTransfer.dispose()
      await assetsTab.close()

      const previewImage = loadImageNode.imagePreview.locator('img')
      const imageLoadError = loadImageNode.root.getByTestId(
        TestIds.errors.imageLoadError
      )
      const expectPreviewLoaded = async () => {
        await expect(loadImageNode.imagePreview).toBeVisible()
        await expect(previewImage).toBeVisible()
        await expect(imageLoadError).toBeHidden()
        await expect
          .poll(() =>
            loadImageNode.imagePreview.evaluate((element) => {
              const image = element.querySelector('img')
              return Boolean(image?.complete && image.naturalWidth > 0)
            })
          )
          .toBe(true)
      }

      await expectPreviewLoaded()
      await comfyPage.menu.topbar.saveWorkflow('annotated-widget-output')

      const workflowsTab = comfyPage.menu.workflowsTab
      await workflowsTab.open()
      const switchAwayAndBack = async () => {
        await workflowsTab.switchToWorkflow('Unsaved Workflow')
        await comfyPage.workflow.waitForWorkflowIdle()
        await workflowsTab.switchToWorkflow('annotated-widget-output')
        await comfyPage.workflow.waitForWorkflowIdle()
      }
      await switchAwayAndBack()
      await expectPreviewLoaded()

      const ws = await getWebSocket()
      const execution = new ExecutionHelper(comfyPage, ws)
      const jobId = await execution.run({
        triggerPrompt: () => comfyPage.runButton.click()
      })
      execution.executed(jobId, '10', {})
      await comfyPage.nextFrame()
      await expectPreviewLoaded()

      await switchAwayAndBack()
      await expectPreviewLoaded()
    }
  )
})
