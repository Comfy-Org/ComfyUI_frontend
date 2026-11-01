import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { WorkspaceStore } from '@e2e/types/globals'

test.describe('Workflow tabs - canvas ownership', { tag: '@canvas' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({})
  })

  test('Repaints and persists the workflow opened after a store-only activation', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'issue',
      description: 'https://linear.app/comfyorg/issue/PM-875'
    })

    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(7)
    await comfyPage.menu.topbar.saveWorkflow('workflow-a')

    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

    const activated = await comfyPage.page.evaluate(async () => {
      const workflowStore = (window.app!.extensionManager as WorkspaceStore)
        .workflow
      const target = workflowStore.openWorkflows.find((workflow) =>
        workflow.path.includes('workflow-a')
      )
      if (!target) throw new Error('workflow-a is not open')
      await workflowStore.openWorkflow(target)
      return workflowStore.activeWorkflow?.path ?? null
    })

    expect(activated).toContain('workflow-a')
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

    await comfyPage.menu.workflowsTab.open()
    await comfyPage.menu.workflowsTab.getPersistedItem('workflow-a').click()

    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(7)

    await comfyPage.workflow.reloadAndWaitForApp()

    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(7)
  })
})
