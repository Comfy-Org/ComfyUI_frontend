import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { BAD_DO_NOT_DO_THIS_LegacyApiHelper } from '@e2e/fixtures/helpers/BAD_DO_NOT_DO_THIS_LegacyApiHelper'
import type { WorkspaceStore } from '@e2e/types/globals'
import { toNodeId } from '@/types/nodeId'

test(
  'Can display workflow name with unsaved legacy position changes',
  { tag: '@smoke' },
  async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')
    const workflowName = `test-${Date.now()}`
    await comfyPage.menu.topbar.saveWorkflow(workflowName)
    await expect
      .poll(() => comfyPage.page.title())
      .toBe(`${workflowName} - ComfyUI`)

    const legacyApi = new BAD_DO_NOT_DO_THIS_LegacyApiHelper(comfyPage.page)
    await legacyApi.moveFirstNodeByMutatingPositionX(toNodeId(3), 50)
    await comfyPage.page.evaluate(async () => {
      ;(
        window.app!.extensionManager as WorkspaceStore
      ).workflow.activeWorkflow?.changeTracker.captureCanvasState()
    })
    await expect
      .poll(() => comfyPage.page.title())
      .toBe(`*${workflowName} - ComfyUI`)

    await comfyPage.page.evaluate(async () => {
      return (
        window.app!.extensionManager as WorkspaceStore
      ).workflow.activeWorkflow?.delete()
    })
  }
)
