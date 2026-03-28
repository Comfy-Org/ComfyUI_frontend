import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'
import type { WorkspaceStore } from '../types/globals'

test.describe(
  'Change Tracker - isLoadingGraph guard',
  { tag: '@workflow' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
    })

    test('Prevents checkState from corrupting workflow state during tab switch', async ({
      comfyPage
    }) => {
      // Tab 0: default workflow (7 nodes)
      expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(7)

      // Save tab 0 so it has a unique name for tab switching
      await comfyPage.menu.topbar.saveWorkflow('workflow-a')

      // Register an extension that forces checkState during graph loading.
      // This simulates the bug scenario where a user clicks during graph loading
      // which triggers a checkState call on the wrong graph, corrupting the activeState.
      await comfyPage.page.evaluate(() => {
        window.app!.registerExtension({
          name: 'TestCheckStateDuringLoad',
          afterConfigureGraph() {
            const workflow = (window.app!.extensionManager as WorkspaceStore)
              .workflow.activeWorkflow
            if (!workflow) throw new Error('No workflow found')
            // Bypass the guard to reproduce the corruption bug:
            // ; (workflow.changeTracker.constructor as unknown as { isLoadingGraph: boolean }).isLoadingGraph = false

            // Simulate the user clicking during graph loading
            workflow.changeTracker.checkState()
          }
        })
      })

      // Create tab 1: blank workflow (0 nodes)
      await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
      await comfyPage.nextFrame()
      expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

      // Switch back to tab 0 (workflow-a).
      const tab0 = comfyPage.menu.topbar.getWorkflowTab('workflow-a')
      await tab0.click()
      await comfyPage.nextFrame()
      expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(7)

      // switch to blank tab and back to verify no corruption
      const tab1 = comfyPage.menu.topbar.getWorkflowTab('Unsaved Workflow')
      await tab1.click()
      await comfyPage.nextFrame()
      expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

      // switch again and verify no corruption
      await tab0.click()
      await comfyPage.nextFrame()
      expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(7)
    })
  }
)
