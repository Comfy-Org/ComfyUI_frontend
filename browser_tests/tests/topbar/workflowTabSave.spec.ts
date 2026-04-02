import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe('Workflow tab save on close', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({})
  })

  test('Closing an inactive tab preserves the active workflow content', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'PR #10745 — closing inactive tab saved active graph into the closing tab'
    })

    await comfyPage.workflow.setupWorkflowsDirectory({
      'wf-A.json': 'default.json',
      'wf-B.json': 'nodes/single_ksampler.json'
    })

    const workflowsTab = comfyPage.menu.workflowsTab
    await workflowsTab.open()

    // Open workflow A (default = 7 nodes)
    await workflowsTab.getPersistedItem('wf-A').dblclick()
    await comfyPage.workflow.waitForWorkflowIdle()
    const nodeCountA = await comfyPage.nodeOps.getNodeCount()
    expect(nodeCountA).toBeGreaterThan(1)

    // Open workflow B (single_ksampler = 1 node)
    await workflowsTab.getPersistedItem('wf-B').dblclick()
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 5000 })
      .toBe(1)

    // Switch to A (making B the inactive tab)
    await comfyPage.menu.topbar.getWorkflowTab('wf-A').click()
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 5000 })
      .toBe(nodeCountA)

    // Close inactive B tab
    await comfyPage.menu.topbar.closeWorkflowTab('wf-B')

    // A should still have its own node count (not B's)
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 5000 })
      .toBe(nodeCountA)
  })
})
