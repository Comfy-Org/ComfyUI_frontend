/**
 * FE-1425: a Load Image node populated from the assets sidebar's Generated tab
 * holds an `[output]`-annotated widget value. The preview must resolve it to
 * the output directory instead of asking for the annotation as part of the
 * filename under `type=input`, which 404s and renders "Image failed to load".
 */
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { createMockJob } from '@e2e/fixtures/helpers/AssetsHelper'
import { TestIds } from '@e2e/fixtures/selectors'

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
    'renders a Generated asset after drag and workflow restore',
    { tag: '@slow' },
    async ({ comfyPage }) => {
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

      await comfyPage.menu.topbar.saveWorkflow('annotated-widget-output')

      const workflowsTab = comfyPage.menu.workflowsTab
      await workflowsTab.open()
      await workflowsTab.switchToWorkflow('Unsaved Workflow')
      await comfyPage.workflow.waitForWorkflowIdle()
      await workflowsTab.switchToWorkflow('annotated-widget-output')
      await comfyPage.workflow.waitForWorkflowIdle()

      const previewImage = loadImageNode.imagePreview.locator('img')
      const imageLoadError = loadImageNode.root.getByTestId(
        TestIds.errors.imageLoadError
      )
      await expect(loadImageNode.imagePreview).toBeVisible()
      await expect(previewImage).toBeVisible()
      await expect(imageLoadError).toBeHidden()
      await expect
        .poll(() =>
          previewImage.evaluate(
            (image: HTMLImageElement) =>
              image.complete && image.naturalWidth > 0
          )
        )
        .toBe(true)
    }
  )
})
