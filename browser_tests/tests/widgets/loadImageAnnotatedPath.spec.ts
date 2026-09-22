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

test.describe(
  'Load Image annotated widget value',
  {
    tag: ['@widget', '@vue-nodes']
  },
  () => {
    test.use({
      initialSettings: {
        'Comfy.Workflow.WorkflowTabsPosition': 'Sidebar'
      }
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
    })

    test(
      'renders a Generated asset after drag and workflow restore',
      { tag: '@slow' },
      async ({ comfyPage, getWebSocket }, testInfo) => {
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

        const loadImageNode =
          await test.step('Drag a Generated asset onto Load Image', async () => {
            await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
            const node =
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
            await node.root.dispatchEvent('dragover', { dataTransfer })
            await node.root.dispatchEvent('drop', { dataTransfer })
            await generatedAsset.dispatchEvent('dragend', { dataTransfer })
            await dataTransfer.dispose()
            await assetsTab.close()

            return node
          })

        const previewImage = loadImageNode.imagePreview.locator('img')
        const imageLoadError = loadImageNode.root.getByTestId(
          TestIds.errors.imageLoadError
        )
        async function expectPreviewLoaded() {
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

        await test.step('Render the dropped output preview', async () => {
          await expectPreviewLoaded()
          await loadImageNode.root.screenshot({
            path: testInfo.outputPath('01-dropped-preview.png')
          })
        })

        await test.step('Save and restore the workflow', async () => {
          await comfyPage.menu.topbar.saveWorkflow('annotated-widget-output')

          const workflowsTab = comfyPage.menu.workflowsTab
          await workflowsTab.open()
          await workflowsTab.switchToWorkflow('Unsaved Workflow')
          await comfyPage.workflow.waitForWorkflowIdle()
          await workflowsTab.switchToWorkflow('annotated-widget-output')
          await comfyPage.workflow.waitForWorkflowIdle()
        })

        await test.step('Render the restored output preview', async () => {
          await expectPreviewLoaded()
        })

        await test.step('Keep the preview through execution and restore', async () => {
          const execution = new ExecutionHelper(comfyPage, await getWebSocket())
          const jobId = await execution.run({
            triggerPrompt: () => comfyPage.runButton.click()
          })
          execution.executionStart(jobId)
          execution.executing(jobId, '10')
          execution.executing(jobId, null)
          execution.executionSuccess(jobId)
          await comfyPage.nextFrame()
          await expectPreviewLoaded()

          const workflowsTab = comfyPage.menu.workflowsTab
          await workflowsTab.switchToWorkflow('Unsaved Workflow')
          await comfyPage.workflow.waitForWorkflowIdle()
          await workflowsTab.switchToWorkflow('annotated-widget-output')
          await comfyPage.workflow.waitForWorkflowIdle()
          await expectPreviewLoaded()
          await workflowsTab.close()
          await loadImageNode.root.screenshot({
            path: testInfo.outputPath('02-restored-preview.png')
          })
        })
      }
    )
  }
)
