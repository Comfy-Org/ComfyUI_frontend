// Playwright E2E test for ComfyUI workflow CRUD operations
// Covers: node addition, save, reload, and delete workflow
// Import the test fixture
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('API Integration', () => {
  test('loads a workflow and displays nodes on the canvas', async ({
    comfyPage
  }) => {
    // Setup the page (mocks releases, clears storage, etc.)
    await comfyPage.setup()

    // Load a minimal workflow (ensure this file exists in browser_tests/assets/)
    await comfyPage.loadWorkflow('primitive/primitive_node_unconnected')

    // Wait for the canvas to render
    await comfyPage.nextFrame()

    // Assert that at least one node is present
    const nodeCount = await comfyPage.getGraphNodesCount()
    expect(nodeCount).toBeGreaterThan(0)
  })
})

test.describe('API Integration - Workflow CRUD', () => {
  test('can add node, save, reload, and delete workflow', async ({
    comfyPage
  }) => {
    await comfyPage.setup()
    // Set node search box settings for reliability
    await comfyPage.setSetting('Comfy.LinkRelease.Action', 'search box')
    await comfyPage.setSetting('Comfy.LinkRelease.ActionShift', 'search box')
    await comfyPage.setSetting('Comfy.NodeSearchBoxImpl', 'default')
    // Ensure UI is ready
    if (comfyPage.closeMenu) await comfyPage.closeMenu()
    if (comfyPage.closeDialog) await comfyPage.closeDialog()
    await comfyPage.page.waitForTimeout(1000)
    // Focus the canvas before double-click
    const canvas = comfyPage.canvas
    const box = await canvas.boundingBox()
    if (box) {
      await comfyPage.page.mouse.click(
        box.x + box.width / 2,
        box.y + box.height / 2
      )
      await comfyPage.page.waitForTimeout(200)
    }
    await comfyPage.page.screenshot({ path: 'debug-before-dblclick.png' })
    // Open node search box
    await comfyPage.doubleClickCanvas()
    try {
      await comfyPage.searchBox.input.waitFor({
        state: 'visible',
        timeout: 5000
      })
    } catch (e) {
      await comfyPage.page.screenshot({ path: 'debug-searchbox-fail.png' })
      throw new Error(
        'Node search box input did not become visible after doubleClickCanvas. See debug-searchbox-fail.png'
      )
    }
    // Add a node with a widget for reliable dirty state
    await comfyPage.searchBox.fillAndSelectFirstNode(
      'CLIP Text Encode (Prompt)'
    )
    await comfyPage.nextFrame()
    await comfyPage.page.waitForTimeout(1000)
    // Move the new node to ensure the workflow is dirty
    const nodes = await comfyPage.getNodes()
    const movableNode = nodes
      .reverse()
      .find(
        (n) =>
          n._pos &&
          typeof n._pos[0] === 'number' &&
          typeof n._pos[1] === 'number'
      )
    if (movableNode) {
      await comfyPage.page.mouse.move(movableNode._pos[0], movableNode._pos[1])
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(
        movableNode._pos[0] + 50,
        movableNode._pos[1] + 50
      )
      await comfyPage.page.mouse.up()
      await comfyPage.nextFrame()
    }
    // Interact with the node widget input to trigger dirty state
    await comfyPage.page.screenshot({ path: 'debug-before-save-btn-wait.png' })
    comfyPage.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // Log browser errors for future debugging
        console.log('Browser console error:', msg.text())
      }
    })
    const nodeInput = comfyPage.page
      .locator(
        '.litegraph .litegraph-widget input[type="number"], .litegraph .litegraph-widget input[type="text"]'
      )
      .first()
    if ((await nodeInput.count()) > 0) {
      const value = await nodeInput.inputValue()
      if (value === '') {
        await nodeInput.fill('1')
      } else {
        await nodeInput.fill(String(Number(value) + 1))
      }
      await comfyPage.page.waitForTimeout(500)
    }
    // Wait for the Save button to become visible and save the workflow
    const saveBtn = comfyPage.page.locator('#comfy-save-button')
    await saveBtn.waitFor({ state: 'visible', timeout: 10000 })
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()
    // Wait for the toast notification as confirmation
    await comfyPage.closeToasts(1)

    // Reload workflow (simulate user action)
    await comfyPage.menu.workflowsTab.open()
    const workflowName = 'Unsaved Workflow'
    await comfyPage.menu.workflowsTab.getPersistedItem(workflowName).click()
    await comfyPage.nextFrame()

    // Assert node is still present
    const nodeCount = await comfyPage.getGraphNodesCount()
    expect(nodeCount).toBeGreaterThan(0)

    // Delete workflow
    await comfyPage.menu.workflowsTab
      .getPersistedItem(workflowName)
      .click({ button: 'right' })
    await comfyPage.clickContextMenuItem('Delete')
    await comfyPage.confirmDialog.delete.click()
    await comfyPage.closeToasts(1)
  })
})
