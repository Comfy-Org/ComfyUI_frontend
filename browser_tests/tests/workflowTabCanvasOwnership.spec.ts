import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { WorkspaceStore } from '@e2e/types/globals'

/**
 * PM-875. A store-only activation moves the selected workflow without loading
 * a graph, so the canvas keeps showing the previous tab's graph. Opening that
 * workflow through the normal user route must then repaint the canvas rather
 * than take the "already active" fast path and leave the mismatch in place.
 *
 * Source: https://github.com/Comfy-Org/ComfyUI_frontend/pull/17331
 */
test.describe('Workflow tabs - canvas ownership', { tag: '@workflow' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({})
  })

  test('Repaints the canvas for a workflow that was activated without a graph load', async ({
    comfyPage
  }) => {
    // Tab 0: default workflow (7 nodes), saved so it has a stable name.
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(7)
    await comfyPage.menu.topbar.saveWorkflow('workflow-a')

    // Tab 1: blank workflow (0 nodes). The canvas now holds this graph.
    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

    // Activate workflow-a in the store only, with no graph load. This is what
    // an extension or the agent does when it moves the selected workflow
    // directly, and it is the state PM-875 was reported from: workflow-a reads
    // as the active workflow while tab 1's blank graph is on the canvas.
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

    // The defect, in visible terms: workflow-a is selected, canvas is empty.
    expect(activated).toContain('workflow-a')
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

    // Open workflow-a the way a user does, from the workflows sidebar. Before
    // the fix this returned immediately because the store already reported
    // workflow-a active, so the blank graph stayed on the canvas.
    await comfyPage.menu.workflowsTab.open()
    await comfyPage.menu.workflowsTab.getPersistedItem('workflow-a').click()

    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(7)
  })
})
