/**
 * FE-1425: a Load Image node populated from the assets sidebar's Generated tab
 * holds an `[output]`-annotated widget value. The preview must resolve it to
 * the output directory instead of asking for the annotation as part of the
 * filename under `type=input`, which 404s and renders "Image failed to load".
 */
import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

test.describe('Load Image annotated widget value', { tag: '@widget' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Sidebar'
    )
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({})
  })

  test('requests an [output] widget value from the output directory', async ({
    comfyPage
  }) => {
    const viewRequests: URL[] = []
    await comfyPage.page.route('**/api/view?*', async (route) => {
      viewRequests.push(new URL(route.request().url()))
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64'
        )
      })
    })

    await comfyPage.workflow.loadWorkflow(
      'widgets/load_image_widget_output_annotated'
    )

    const generatedRequests = () =>
      viewRequests.filter((url) =>
        url.searchParams.get('filename')?.includes('generated')
      )

    await expect(() => expect(generatedRequests()).not.toHaveLength(0)).toPass({
      timeout: 15_000
    })

    const params = generatedRequests()[0].searchParams
    expect(params.get('type')).toBe('output')
    expect(params.get('filename')).toBe('generated.png')
    expect(params.get('subfolder')).toBe('runs/2026')
  })

  test(
    'preserves an annotated widget preview across a workflow tab switch',
    { tag: '@slow' },
    async ({ comfyPage, getWebSocket }) => {
      test.setTimeout(30_000)
      await comfyPage.page.route('**/api/view?*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          body: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'base64'
          )
        })
      })

      const tab = comfyPage.menu.workflowsTab
      await tab.open()
      await comfyPage.workflow.loadWorkflow(
        'widgets/load_image_widget_output_annotated'
      )
      await comfyPage.menu.topbar.saveWorkflow('annotated-widget-output')

      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            () => window.app!.nodeOutputs?.['10']?.images?.[0]?.filename
          )
        )
        .toBe('generated.png')

      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await comfyPage.workflow.waitForWorkflowIdle()
      await tab.switchToWorkflow('annotated-widget-output')
      await comfyPage.workflow.waitForWorkflowIdle()

      const ws = await getWebSocket()
      const execution = new ExecutionHelper(comfyPage, ws)
      const jobId = await execution.run()
      execution.executed(jobId, '10', {})

      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            () => window.app!.nodeOutputs?.['10']?.images?.[0]?.filename
          )
        )
        .toBe('generated.png')

      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await comfyPage.workflow.waitForWorkflowIdle()
      await tab.switchToWorkflow('annotated-widget-output')
      await comfyPage.workflow.waitForWorkflowIdle()

      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            () => window.app!.nodeOutputs?.['10']?.images?.[0]?.filename
          )
        )
        .toBe('generated.png')
    }
  )
})
