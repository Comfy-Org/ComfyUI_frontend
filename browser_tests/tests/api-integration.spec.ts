// Playwright E2E test for ComfyUI workflow CRUD operations
// Covers: node addition, save, reload, and delete workflow
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.setTimeout(60000) // Increase timeout to 60 seconds for all tests

const NODE_TYPE = 'CLIP Text Encode (Prompt)'
const WORKFLOW_NAME = 'Unsaved Workflow'

// Common setup for all tests
const setupComfyPage = async (comfyPage) => {
  await comfyPage.setup()
  await comfyPage.setSetting('Comfy.LinkRelease.Action', 'search box')
  await comfyPage.setSetting('Comfy.LinkRelease.ActionShift', 'search box')
  await comfyPage.setSetting('Comfy.NodeSearchBoxImpl', 'default')
  if (comfyPage.closeMenu) await comfyPage.closeMenu()
  if (comfyPage.closeDialog) await comfyPage.closeDialog()
  await comfyPage.page.waitForTimeout(500)
  // Focus canvas
  const canvas = comfyPage.canvas
  const box = await canvas.boundingBox()
  if (box) {
    await comfyPage.page.mouse.click(
      box.x + box.width / 2,
      box.y + box.height / 2
    )
    await comfyPage.page.waitForTimeout(100)
  }
}

test.describe('API Integration - Workflow CRUD', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await setupComfyPage(comfyPage)
  })

  test('can add node to canvas', async ({ comfyPage }) => {
    // Close any open overlays or textareas
    await comfyPage.page.keyboard.press('Escape')
    await comfyPage.page.mouse.click(10, 10)
    await comfyPage.canvas.click() // Focus canvas before double-click
    await comfyPage.doubleClickCanvas()
    await comfyPage.searchBox.input.waitFor({ state: 'visible', timeout: 5000 })
    await comfyPage.searchBox.fillAndSelectFirstNode(NODE_TYPE)
    await comfyPage.nextFrame()
    const nodeCount = await comfyPage.getGraphNodesCount()
    expect(nodeCount).toBeGreaterThan(0)
  })

  test('can save workflow', async ({ comfyPage }) => {
    // Add node
    await comfyPage.doubleClickCanvas()
    await comfyPage.searchBox.input.waitFor({ state: 'visible', timeout: 5000 })
    await comfyPage.searchBox.fillAndSelectFirstNode(NODE_TYPE)
    await comfyPage.nextFrame()
    // Interact with widget input to dirty workflow
    const nodeInput = comfyPage.page
      .locator(
        '.litegraph .litegraph-widget input[type="number"], .litegraph .litegraph-widget input[type="text"]'
      )
      .first()
    if ((await nodeInput.count()) > 0) {
      const value = await nodeInput.inputValue()
      await nodeInput.fill(value === '' ? '1' : String(Number(value) + 1))
      await comfyPage.page.waitForTimeout(200)
    }
    // Save
    const saveBtn = comfyPage.page.locator('#comfy-save-button')
    await saveBtn.waitFor({ state: 'visible', timeout: 10000 })
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()
    await comfyPage.closeToasts(1)
  })

  test('can reload saved workflow', async ({ comfyPage }) => {
    // Assume workflow is already saved as WORKFLOW_NAME
    await comfyPage.menu.workflowsTab.open()
    await comfyPage.menu.workflowsTab.getPersistedItem(WORKFLOW_NAME).click()
    await comfyPage.nextFrame()
    const nodeCount = await comfyPage.getGraphNodesCount()
    expect(nodeCount).toBeGreaterThan(0)
  })

  test('can delete workflow', async ({ comfyPage }) => {
    await comfyPage.menu.workflowsTab.open()
    await comfyPage.menu.workflowsTab
      .getPersistedItem(WORKFLOW_NAME)
      .click({ button: 'right' })
    await comfyPage.clickContextMenuItem('Delete')
    await comfyPage.confirmDialog.delete.click()
    await comfyPage.closeToasts(1)
    // Optionally, check that the workflow is no longer present
    const exists = await comfyPage.menu.workflowsTab
      .getPersistedItem(WORKFLOW_NAME)
      .isVisible()
      .catch(() => false)
    expect(exists).toBeFalsy()
  })
})
