import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe(
  'Keybinding non-Latin keyboard layout support',
  { tag: '@keyboard' },
  () => {
    test('Ctrl+A selects all nodes on a non-Latin keyboard layout', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      // Baseline: standard US layout Ctrl+A select-all works
      await comfyPage.workflow.loadWorkflow('default')
      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBeGreaterThan(0)

      await comfyPage.canvas.press('Control+a')
      await expect
        .poll(() => comfyPage.nodeOps.getSelectedGraphNodesCount())
        .toBeGreaterThan(0)
      await comfyPage.canvas.press('Delete')
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

      // Non-Latin layout: dispatch a keydown with Arabic key but US code.
      // On an Arabic keyboard layout, pressing the physical 'A' key produces
      // 'ش' as event.key, but event.code remains 'KeyA'.
      // The fix in resolveKeyFromEvent uses event.code to resolve the
      // physical key, so Ctrl+A should still trigger select-all.
      await comfyPage.workflow.loadWorkflow('default')
      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBeGreaterThan(0)

      // Dispatch from the canvas container so composedPath includes it
      // (the keybinding service checks targetElementId containment).
      await page.evaluate(() => {
        const canvas = document.getElementById('graph-canvas-container')
        canvas?.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'ش',
            code: 'KeyA',
            ctrlKey: true,
            bubbles: true,
            cancelable: true
          })
        )
      })

      await expect
        .poll(() => comfyPage.nodeOps.getSelectedGraphNodesCount())
        .toBeGreaterThan(0)

      await comfyPage.canvas.press('Delete')
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
    })
  }
)
