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

  test('Closing an inactive tab preserves both workflows content', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'PR #10745 — closing inactive tab saved active graph into the closing tab'
    })

    const suffix = Date.now().toString(36)
    const nameA = `wf-A-${suffix}`
    const nameB = `wf-B-${suffix}`

    // Save default workflow as A (has multiple nodes)
    await comfyPage.menu.topbar.saveWorkflow(nameA)
    const nodeCountA = await comfyPage.nodeOps.getNodeCount()
    expect(nodeCountA).toBeGreaterThan(1)

    // Load a single-node workflow and save as B
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await comfyPage.nextFrame()
    await comfyPage.menu.topbar.saveWorkflow(nameB)

    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 3000 })
      .toBe(1)
    const nodeCountB = 1

    expect(nodeCountA).not.toBe(nodeCountB)

    // Switch to A (making B the inactive tab)
    await comfyPage.menu.topbar.getWorkflowTab(nameA).click()
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 3000 })
      .toBe(nodeCountA)

    // Close inactive B tab
    await comfyPage.menu.topbar.closeWorkflowTab(nameB)
    await comfyPage.nextFrame()

    // A should still have its own node count
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 3000 })
      .toBe(nodeCountA)

    // Reopen B from the sidebar saved list
    const workflowsTab = comfyPage.menu.workflowsTab
    await workflowsTab.open()
    await workflowsTab.getPersistedItem(nameB).dblclick()
    await comfyPage.workflow.waitForWorkflowIdle()

    // B should still have exactly 1 node, not A's content
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 5000 })
      .toBe(nodeCountB)
  })

  test('Closing a modified inactive tab with save preserves its content', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'PR #10745 — saveWorkflow on modified inactive tab serialized active graph'
    })

    const suffix = Date.now().toString(36)
    const nameA = `wf-A-${suffix}`
    const nameB = `wf-B-${suffix}`

    // Save default workflow as A
    await comfyPage.menu.topbar.saveWorkflow(nameA)
    const nodeCountA = await comfyPage.nodeOps.getNodeCount()

    // Duplicate to create B, then add a Note node to differentiate
    await comfyPage.command.executeCommand('Comfy.DuplicateWorkflow')
    await comfyPage.nextFrame()
    await comfyPage.menu.topbar.saveWorkflow(nameB)

    await comfyPage.page.evaluate(() => {
      window.app!.graph.add(window.LiteGraph!.createNode('Note', undefined, {}))
    })
    await comfyPage.nextFrame()

    const nodeCountB = await comfyPage.nodeOps.getNodeCount()
    expect(nodeCountB).toBe(nodeCountA + 1)

    // Mark B as modified so closing triggers "Save before closing?"
    await comfyPage.page.evaluate(() => {
      const em = window.app!.extensionManager as unknown as Record<
        string,
        { activeWorkflow?: { changeTracker?: { checkState(): void } } }
      >
      em.workflow?.activeWorkflow?.changeTracker?.checkState()
    })

    // Switch to A (B becomes inactive and modified)
    await comfyPage.menu.topbar.getWorkflowTab(nameA).click()
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 3000 })
      .toBe(nodeCountA)

    // Close inactive modified B tab via middle-click
    await comfyPage.menu.topbar.getWorkflowTab(nameB).click({
      button: 'middle'
    })

    // Click "Save" in the confirmation dialog
    const saveButton = comfyPage.page.getByRole('button', { name: 'Save' })
    await saveButton.waitFor({ state: 'visible' })
    await saveButton.click()
    await comfyPage.workflow.waitForWorkflowIdle()
    await comfyPage.nextFrame()

    // A should still have its original content
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 3000 })
      .toBe(nodeCountA)

    // Reopen B and verify it kept its own content (A's nodes + Note)
    const workflowsTab = comfyPage.menu.workflowsTab
    await workflowsTab.open()
    await workflowsTab.getPersistedItem(nameB).dblclick()
    await comfyPage.workflow.waitForWorkflowIdle()

    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 5000 })
      .toBe(nodeCountB)
  })

  test('Closing an unsaved inactive tab with save-as preserves its content', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'PR #10745 — saveWorkflowAs on inactive temp tab serialized the active graph'
    })

    const suffix = Date.now().toString(36)
    const nameA = `wf-A-${suffix}`
    const nameB = `wf-B-${suffix}`

    // Save default workflow as A
    await comfyPage.menu.topbar.saveWorkflow(nameA)
    const nodeCountA = await comfyPage.nodeOps.getNodeCount()

    // Create a new blank workflow and add a Note node
    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.nextFrame()

    await comfyPage.page.evaluate(() => {
      window.app!.graph.add(window.LiteGraph!.createNode('Note', undefined, {}))
    })
    await comfyPage.nextFrame()

    // Mark it as modified
    await comfyPage.page.evaluate(() => {
      const em = window.app!.extensionManager as unknown as Record<
        string,
        { activeWorkflow?: { changeTracker?: { checkState(): void } } }
      >
      em.workflow?.activeWorkflow?.changeTracker?.checkState()
    })

    const nodeCountB = await comfyPage.nodeOps.getNodeCount()
    expect(nodeCountB).toBe(1)
    expect(nodeCountA).not.toBe(nodeCountB)

    // Switch to A (making the unsaved workflow inactive)
    await comfyPage.menu.topbar.getWorkflowTab(nameA).click()
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 3000 })
      .toBe(nodeCountA)

    // Close the inactive unsaved tab
    await comfyPage.menu.topbar
      .getWorkflowTab('Unsaved Workflow')
      .click({ button: 'middle' })

    // Click "Save" in the confirmation dialog
    const dialog = comfyPage.page.getByRole('dialog')
    const saveButton = dialog.getByRole('button', { name: 'Save' })
    await saveButton.waitFor({ state: 'visible' })
    await saveButton.click()

    // Fill the save-as filename
    const saveDialog = comfyPage.menu.topbar.getSaveDialog()
    await saveDialog.waitFor({ state: 'visible' })
    await saveDialog.fill(nameB)
    await comfyPage.page.keyboard.press('Enter')
    await comfyPage.workflow.waitForWorkflowIdle()
    await comfyPage.nextFrame()

    // A should still have its content
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 3000 })
      .toBe(nodeCountA)

    // Reopen B and verify it has its own content (1 Note node)
    const workflowsTab = comfyPage.menu.workflowsTab
    await workflowsTab.open()
    await workflowsTab.getPersistedItem(nameB).dblclick()
    await comfyPage.workflow.waitForWorkflowIdle()

    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 5000 })
      .toBe(nodeCountB)
  })
})
