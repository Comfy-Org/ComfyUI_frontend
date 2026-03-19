import type { Page } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../fixtures/ComfyPage'
import type { ComfyPage } from '../../../fixtures/ComfyPage'
import { fitToViewInstant } from '../../../helpers/fitToView'

/**
 * Inject linearData into the current graph so that the app mode toggle
 * recognises output nodes and shows the linear UI.
 */
async function injectLinearData(page: Page) {
  await page.evaluate(async () => {
    const graph = window.app!.graph
    if (!graph) return

    const outputNodeIds = graph.nodes
      .filter(
        (n: { type?: string }) =>
          n.type === 'SaveImage' || n.type === 'PreviewImage'
      )
      .map((n: { id: number | string }) => String(n.id))

    const workflow = graph.serialize() as unknown as Record<string, unknown>
    const extra = (workflow.extra ?? {}) as Record<string, unknown>
    extra.linearData = { inputs: [], outputs: outputNodeIds }
    workflow.extra = extra
    await window.app!.loadGraphData(
      workflow as unknown as Parameters<
        NonNullable<typeof window.app>['loadGraphData']
      >[0]
    )
  })
}

async function enterAppMode(comfyPage: ComfyPage) {
  await injectLinearData(comfyPage.page)
  await comfyPage.nextFrame()

  await comfyPage.page.evaluate(() => {
    window.app!.extensionManager.command.execute('Comfy.ToggleLinear')
  })
  await comfyPage.nextFrame()
}

async function enterGraphMode(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate(() => {
    window.app!.extensionManager.command.execute('Comfy.ToggleLinear')
  })
  await comfyPage.nextFrame()
}

test.describe(
  'Vue Node links after mode switch',
  { tag: ['@screenshot', '@canvas'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.vueNodes.waitForNodes()
      await fitToViewInstant(comfyPage)
    })

    test('links render correctly after switching to app mode and back', async ({
      comfyPage
    }) => {
      // Capture baseline screenshot with links visible in graph mode
      await expect(comfyPage.canvas).toHaveScreenshot(
        'mode-switch-links-before.png'
      )

      // Switch to app mode — graph canvas hidden via display:none
      await enterAppMode(comfyPage)
      await expect(
        comfyPage.page.locator('[data-testid="linear-widgets"]')
      ).toBeVisible({ timeout: 5000 })

      // Switch back to graph mode
      await enterGraphMode(comfyPage)
      await comfyPage.vueNodes.waitForNodes()
      await fitToViewInstant(comfyPage)

      // Links must render at the same positions as before the mode switch
      await expect(comfyPage.canvas).toHaveScreenshot(
        'mode-switch-links-after.png'
      )
    })
  }
)
