import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { WorkspaceStore } from '@e2e/types/globals'

test.describe('Browser tab title', { tag: '@smoke' }, () => {
  test.describe('Beta Menu', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    })

    test('Can display workflow name', async ({ comfyPage }) => {
      const workflowName = await comfyPage.page.evaluate(async () => {
        return (window.app!.extensionManager as WorkspaceStore).workflow
          .activeWorkflow?.filename
      })
      await expect
        .poll(() => comfyPage.page.title())
        .toBe(`*${workflowName} - ComfyUI`)
    })

    test('Can display workflow name with unsaved changes', async ({
      comfyPage
    }) => {
      const workflowName = `test-${Date.now()}`
      await comfyPage.menu.topbar.saveWorkflow(workflowName)
      await expect
        .poll(() => comfyPage.page.title())
        .toBe(`${workflowName} - ComfyUI`)

      await comfyPage.page.evaluate(async () => {
        const node = window.app!.graph!.nodes[0]
        node.pos[0] += 50
        window.app!.graph!.setDirtyCanvas(true, true)
        ;(
          window.app!.extensionManager as WorkspaceStore
        ).workflow.activeWorkflow?.changeTracker?.captureCanvasState()
      })
      await expect
        .poll(() => comfyPage.page.title())
        .toBe(`*${workflowName} - ComfyUI`)

      // Delete the saved workflow for cleanup.
      await comfyPage.page.evaluate(async () => {
        return (
          window.app!.extensionManager as WorkspaceStore
        ).workflow.activeWorkflow?.delete()
      })
    })
  })

  test.describe('Legacy Menu', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    })

    test('Can display default title', async ({ comfyPage }) => {
      await expect.poll(() => comfyPage.page.title()).toBe('ComfyUI')
    })
  })
})
