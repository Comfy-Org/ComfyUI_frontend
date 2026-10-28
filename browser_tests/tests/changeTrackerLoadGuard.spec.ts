import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { WorkspaceStore } from '@e2e/types/globals'

test.describe('Change Tracker - load guard', { tag: '@workflow' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({})
  })

  test('Prevents captureCanvasState from corrupting workflow state during tab switch', async ({
    comfyPage
  }) => {
    await comfyPage.expectNodeCount(7)

    await comfyPage.menu.topbar.saveWorkflow('workflow-a')

    await comfyPage.page.evaluate(() => {
      window.app!.registerExtension({
        name: 'TestCheckStateDuringLoad',
        afterConfigureGraph() {
          const workflow = (window.app!.extensionManager as WorkspaceStore)
            .workflow.activeWorkflow
          if (!workflow) throw new Error('No workflow found')
          workflow.changeTracker.captureCanvasState()
        }
      })
    })

    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    await comfyPage.expectNodeCount(0)

    const tab0 = comfyPage.menu.topbar.getWorkflowTab('workflow-a')
    await tab0.click()
    await comfyPage.expectNodeCount(7)

    const tab1 = comfyPage.menu.topbar.getWorkflowTab('Unsaved Workflow')
    await tab1.click()
    await comfyPage.expectNodeCount(0)

    await tab0.click()
    await comfyPage.expectNodeCount(7)
  })
})
