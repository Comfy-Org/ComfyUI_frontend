import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { WorkspaceStore } from '@e2e/types/globals'

test.describe('Browser tab title', { tag: '@smoke' }, () => {
  test.describe('Beta Menu', () => {
    test('Can display workflow name', async ({ comfyPage }) => {
      const workflowName = await comfyPage.page.evaluate(async () => {
        return (window.app!.extensionManager as WorkspaceStore).workflow
          .activeWorkflow?.filename
      })
      await expect
        .poll(() => comfyPage.page.title())
        .toBe(`*${workflowName} - ComfyUI`)
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
