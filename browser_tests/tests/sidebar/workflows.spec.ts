import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Workflows sidebar', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Sidebar'
    )

    // Open the sidebar
    const tab = comfyPage.menu.workflowsTab
    await tab.open()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({})
  })

  test('Can create new blank workflow', async ({ comfyPage }) => {
    const tab = comfyPage.menu.workflowsTab
    await expect
      .poll(() => tab.getOpenedWorkflowNames())
      .toEqual(['*Unsaved Workflow'])

    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await expect
      .poll(() => tab.getOpenedWorkflowNames())
      .toEqual(['*Unsaved Workflow', '*Unsaved Workflow (2)'])
  })

  test('Can show top level saved workflows', async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({
      'workflow1.json': 'default.json',
      'workflow2.json': 'default.json'
    })

    const tab = comfyPage.menu.workflowsTab
    await tab.open()
    await expect
      .poll(() => tab.getTopLevelSavedWorkflowNames())
      .toEqual(expect.arrayContaining(['workflow1', 'workflow2']))
  })

  test('Can duplicate workflow', async ({ comfyPage }) => {
    const tab = comfyPage.menu.workflowsTab
    await comfyPage.menu.topbar.saveWorkflow('workflow1')

    await expect
      .poll(() => tab.getTopLevelSavedWorkflowNames())
      .toEqual(expect.arrayContaining(['workflow1']))

    await comfyPage.command.executeCommand('Comfy.DuplicateWorkflow')
    await expect
      .poll(() => tab.getOpenedWorkflowNames())
      .toEqual(['workflow1', '*workflow1 (Copy)'])

    await comfyPage.command.executeCommand('Comfy.DuplicateWorkflow')
    await expect
      .poll(() => tab.getOpenedWorkflowNames())
      .toEqual(['workflow1', '*workflow1 (Copy)', '*workflow1 (Copy) (2)'])

    await comfyPage.command.executeCommand('Comfy.DuplicateWorkflow')
    await expect
      .poll(() => tab.getOpenedWorkflowNames())
      .toEqual([
        'workflow1',
        '*workflow1 (Copy)',
        '*workflow1 (Copy) (2)',
        '*workflow1 (Copy) (3)'
      ])
  })

  test('Can open workflow after insert', async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({
      'workflow1.json': 'nodes/single_ksampler.json'
    })

    const tab = comfyPage.menu.workflowsTab
    await tab.open()
    await comfyPage.command.executeCommand('Comfy.LoadDefaultWorkflow')
    const originalNodeCount = await comfyPage.nodeOps.getNodeCount()

    await tab.insertWorkflow(tab.getPersistedItem('workflow1'))
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toEqual(originalNodeCount + 1)

    await tab.getPersistedItem('workflow1').click()
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toEqual(1)
  })

  test('Can rename nested workflow from opened workflow item', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({
      foo: {
        'bar.json': 'default.json'
      }
    })

    const tab = comfyPage.menu.workflowsTab
    await tab.open()
    // Switch to the parent folder
    await tab.getPersistedItem('foo').click()
    // Switch to the nested workflow
    await tab.getPersistedItem('bar').click()

    const openedWorkflow = tab.getOpenedItem('foo/bar')
    await tab.renameWorkflow(openedWorkflow, 'foo/baz')
    await expect
      .poll(() => tab.getOpenedWorkflowNames())
      .toEqual(['*Unsaved Workflow', 'foo/baz'])
  })

  test('Can save workflow as', async ({ comfyPage }) => {
    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.menu.topbar.saveWorkflowAs('workflow3')
    await expect
      .poll(() => comfyPage.menu.workflowsTab.getOpenedWorkflowNames())
      .toEqual(['*Unsaved Workflow', 'workflow3'])

    await comfyPage.menu.topbar.saveWorkflowAs('workflow4')
    await expect
      .poll(() => comfyPage.menu.workflowsTab.getOpenedWorkflowNames())
      .toEqual(['*Unsaved Workflow', 'workflow3', 'workflow4'])
  })

  test('Exported workflow does not contain localized slot names', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')
    await expect
      .poll(() => comfyPage.workflow.getExportedWorkflow({ api: false }))
      .toBeDefined()
    const exportedWorkflow = await comfyPage.workflow.getExportedWorkflow({
      api: false
    })
    for (const node of exportedWorkflow.nodes) {
      for (const slot of node.inputs ?? []) {
        expect(slot.localized_name).toBeUndefined()
        expect(slot.label).toBeUndefined()
      }
      for (const slot of node.outputs ?? []) {
        expect(slot.localized_name).toBeUndefined()
        expect(slot.label).toBeUndefined()
      }
    }
  })

  test('Can export same workflow with different locales', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')

    // Setup download listener before triggering the export
    const downloadPromise = comfyPage.page.waitForEvent('download')
    await comfyPage.menu.topbar.exportWorkflow('exported_default.json')

    // Wait for the download and get the file content
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('exported_default.json')

    // Get the exported workflow content
    const downloadedContent = await comfyPage.workflow.getExportedWorkflow({
      api: false
    })

    await comfyPage.settings.setSetting('Comfy.Locale', 'zh')
    await comfyPage.setup()

    const downloadedContentZh = await comfyPage.workflow.getExportedWorkflow({
      api: false
    })

    // Compare the exported workflow with the original
    delete downloadedContent.id
    delete downloadedContentZh.id
    expect(downloadedContent).toBeDefined()
    expect(downloadedContent).toEqual(downloadedContentZh)
  })

  test('Can save workflow as with same name', async ({ comfyPage }) => {
    await comfyPage.menu.topbar.saveWorkflow('workflow5')
    await expect
      .poll(() => comfyPage.menu.workflowsTab.getOpenedWorkflowNames())
      .toEqual(['workflow5'])

    await comfyPage.menu.topbar.saveWorkflowAs('workflow5')
    await comfyPage.confirmDialog.click('overwrite')
    await expect
      .poll(() => comfyPage.menu.workflowsTab.getOpenedWorkflowNames())
      .toEqual(['workflow5'])
  })

  test('Can save temporary workflow with unmodified name', async ({
    comfyPage
  }) => {
    await expect
      .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
      .toBe(false)

    await comfyPage.menu.topbar.saveWorkflow('Unsaved Workflow')
    // Should not trigger the overwrite dialog
    await expect
      .poll(() =>
        comfyPage.page.locator('.comfy-modal-content:visible').count()
      )
      .toBe(0)

    await expect
      .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
      .toBe(false)
  })

  test('Can overwrite other workflows with save as', async ({ comfyPage }) => {
    const topbar = comfyPage.menu.topbar
    await topbar.saveWorkflow('workflow1')
    await topbar.saveWorkflowAs('workflow2')
    await comfyPage.nextFrame()
    await expect
      .poll(() => comfyPage.menu.workflowsTab.getOpenedWorkflowNames())
      .toEqual(['workflow1', 'workflow2'])
    await expect
      .poll(() => comfyPage.menu.workflowsTab.getActiveWorkflowName())
      .toEqual('workflow2')

    await topbar.saveWorkflowAs('workflow1')
    await comfyPage.confirmDialog.click('overwrite')
    // The old workflow1 should be deleted and the new one should be saved.
    await expect
      .poll(() => comfyPage.menu.workflowsTab.getOpenedWorkflowNames())
      .toEqual(['workflow2', 'workflow1'])
    await expect
      .poll(() => comfyPage.menu.workflowsTab.getActiveWorkflowName())
      .toEqual('workflow1')
  })

  test('Reports missing nodes warning again when switching back to workflow', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
    await comfyPage.workflow.loadWorkflow('missing/missing_nodes')

    const errorOverlay = comfyPage.page.getByTestId(
      TestIds.dialogs.errorOverlay
    )
    await expect(errorOverlay).toBeVisible()

    // Dismiss the error overlay
    await errorOverlay.getByTestId(TestIds.dialogs.errorOverlayDismiss).click()
    await expect(errorOverlay).not.toBeVisible()

    // Load blank workflow
    await comfyPage.menu.workflowsTab.open()
    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')

    // Switch back to the missing_nodes workflow — overlay should reappear
    // so users can install missing node packs without a page reload
    await comfyPage.menu.workflowsTab.switchToWorkflow('missing_nodes')

    await expect(errorOverlay).toBeVisible()
  })

  test('Can close saved-workflows from the open workflows section', async ({
    comfyPage
  }) => {
    await comfyPage.menu.topbar.saveWorkflow(
      `tempWorkflow-${test.info().title}`
    )
    const closeButton = comfyPage.page.locator(
      '.comfyui-workflows-open .close-workflow-button'
    )
    await closeButton.click()
    await expect
      .poll(() => comfyPage.menu.workflowsTab.getOpenedWorkflowNames(), {
        timeout: 5000
      })
      .toEqual(['*Unsaved Workflow'])
  })

  test('Can close saved workflow with command', async ({ comfyPage }) => {
    const tab = comfyPage.menu.workflowsTab
    await comfyPage.menu.topbar.saveWorkflow('workflow1')
    await comfyPage.command.executeCommand('Workspace.CloseWorkflow')
    await expect
      .poll(() => tab.getOpenedWorkflowNames())
      .toEqual(['*Unsaved Workflow'])
  })

  test('Can delete workflows (confirm disabled)', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Workflow.ConfirmDelete', false)

    const { topbar, workflowsTab } = comfyPage.menu

    const filename = 'workflow18'
    await topbar.saveWorkflow(filename)
    await expect
      .poll(() => workflowsTab.getOpenedWorkflowNames())
      .toEqual([filename])

    await workflowsTab.getOpenedItem(filename).click({ button: 'right' })
    await comfyPage.nextFrame()
    await comfyPage.contextMenu.clickMenuItem('Delete')
    await expect(workflowsTab.getOpenedItem(filename)).not.toBeVisible()
    await expect
      .poll(() => workflowsTab.getOpenedWorkflowNames())
      .toEqual(['*Unsaved Workflow'])
  })

  test('Can delete workflows', async ({ comfyPage }) => {
    const { topbar, workflowsTab } = comfyPage.menu

    const filename = 'workflow18'
    await topbar.saveWorkflow(filename)
    await expect
      .poll(() => workflowsTab.getOpenedWorkflowNames())
      .toEqual([filename])

    await workflowsTab.getOpenedItem(filename).click({ button: 'right' })
    await comfyPage.contextMenu.clickMenuItem('Delete')
    await comfyPage.nextFrame()

    await comfyPage.confirmDialog.click('delete')

    await expect(workflowsTab.getOpenedItem(filename)).not.toBeVisible()
    await expect
      .poll(() => workflowsTab.getOpenedWorkflowNames())
      .toEqual(['*Unsaved Workflow'])
  })

  test('Can duplicate workflow from context menu', async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({
      'workflow1.json': 'default.json'
    })

    const { workflowsTab } = comfyPage.menu
    await workflowsTab.open()

    await workflowsTab.getPersistedItem('workflow1').click({ button: 'right' })
    await comfyPage.contextMenu.clickMenuItem('Duplicate')
    await expect
      .poll(() => workflowsTab.getOpenedWorkflowNames())
      .toEqual(['*Unsaved Workflow', '*workflow1 (Copy)'])
  })

  test('Can drop workflow from workflows sidebar', async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({
      'workflow1.json': 'default.json'
    })

    await comfyPage.menu.workflowsTab.open()

    // Wait for workflow to appear in Browse section after sync
    const workflowItem =
      comfyPage.menu.workflowsTab.getPersistedItem('workflow1')
    await expect(workflowItem).toBeVisible({ timeout: 3000 })

    const nodeCount = await comfyPage.nodeOps.getGraphNodesCount()

    // Get the bounding box of the canvas element
    const canvasBoundingBox = (await comfyPage.page
      .locator('#graph-canvas')
      .boundingBox())!

    // Calculate the center position of the canvas
    const targetPosition = {
      x: canvasBoundingBox.x + canvasBoundingBox.width / 2,
      y: canvasBoundingBox.y + canvasBoundingBox.height / 2
    }

    await comfyPage.page.dragAndDrop(
      '.comfyui-workflows-browse .node-label:has-text("workflow1")',
      '#graph-canvas',
      { targetPosition }
    )

    // Wait for nodes to be inserted after drag-drop with retryable assertion
    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBe(nodeCount * 2)
  })
})
