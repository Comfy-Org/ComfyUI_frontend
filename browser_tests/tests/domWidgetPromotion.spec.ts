import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import type { ComfyPage } from '../fixtures/ComfyPage'
import type { NodeReference } from '../fixtures/litegraph'

/**
 * Helper to navigate into a subgraph with retry logic
 */
async function navigateIntoSubgraph(
  comfyPage: ComfyPage,
  subgraphNode: NodeReference
) {
  const nodePos = await subgraphNode.getPosition()
  const nodeSize = await subgraphNode.getSize()

  // Use simple navigation for tests without promoted widgets blocking
  await comfyPage.canvas.dblclick({
    position: {
      x: nodePos.x + nodeSize.width / 2,
      y: nodePos.y + 10 // Click below the title
    }
  })
  await comfyPage.nextFrame()
  await comfyPage.page.waitForTimeout(100)
}

/**
 * Helper to navigate into a subgraph when DOM widgets might interfere
 * Uses retry logic with different click positions
 */
async function navigateIntoSubgraphWithRetry(
  comfyPage: ComfyPage,
  subgraphNode: NodeReference
) {
  const nodePos = await subgraphNode.getPosition()
  const nodeSize = await subgraphNode.getSize()

  let attempts = 0
  const maxAttempts = 3
  let isInSubgraph = false

  while (attempts < maxAttempts && !isInSubgraph) {
    attempts++

    // Clear any existing selection that might interfere
    await comfyPage.canvas.click({
      position: { x: 50, y: 50 }
    })
    await comfyPage.nextFrame()

    // Try different click positions to avoid DOM widget interference
    const clickPositions = [
      { x: nodePos.x + nodeSize.width / 2, y: nodePos.y + 15 }, // Near top
      { x: nodePos.x + nodeSize.width / 2, y: nodePos.y + nodeSize.height / 2 }, // Center
      { x: nodePos.x + 20, y: nodePos.y + nodeSize.height / 2 } // Left side
    ]

    const position =
      clickPositions[Math.min(attempts - 1, clickPositions.length - 1)]

    await comfyPage.canvas.dblclick({ position })
    await comfyPage.nextFrame()
    await comfyPage.page.waitForTimeout(300)

    // Check if we're now in the subgraph
    isInSubgraph = await comfyPage.page.evaluate(() => {
      const graph = window['app'].canvas.graph
      return graph?.constructor?.name === 'Subgraph'
    })

    if (isInSubgraph) {
      break
    }
  }

  if (!isInSubgraph) {
    throw new Error(
      `Failed to navigate into subgraph after ${maxAttempts} attempts`
    )
  }
}

test.describe('DOM Widget Promotion', () => {
  test('DOM widget visibility persists through subgraph navigation', async ({
    comfyPage
  }) => {
    // Load workflow with promoted text widget
    await comfyPage.loadWorkflow('subgraph-with-promoted-text-widget')
    await comfyPage.nextFrame()

    // Check that the promoted widget's DOM element is visible in parent graph
    const parentTextarea = await comfyPage.page.locator(
      '.comfy-multiline-input'
    )
    await expect(parentTextarea).toBeVisible()
    await expect(parentTextarea).toHaveCount(1)

    // Get subgraph node
    const subgraphNode = await comfyPage.getNodeRefById('11')
    if (!(await subgraphNode.exists())) {
      throw new Error('Subgraph node with ID 11 not found')
    }

    // Navigate into the subgraph
    await navigateIntoSubgraph(comfyPage, subgraphNode)

    // Check that the original widget's DOM element is visible in subgraph
    const subgraphTextarea = await comfyPage.page.locator(
      '.comfy-multiline-input'
    )
    await expect(subgraphTextarea).toBeVisible()
    await expect(subgraphTextarea).toHaveCount(1)

    // Navigate back to parent graph
    await comfyPage.page.keyboard.press('Escape')
    await comfyPage.nextFrame()

    // Check that the promoted widget's DOM element is still visible
    const backToParentTextarea = await comfyPage.page.locator(
      '.comfy-multiline-input'
    )
    await expect(backToParentTextarea).toBeVisible()
    await expect(backToParentTextarea).toHaveCount(1)
  })

  test('DOM widget content is preserved through navigation', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('subgraph-with-promoted-text-widget')

    // Type some text in the promoted widget
    const textarea = await comfyPage.page.locator('.comfy-multiline-input')
    await textarea.fill('Test content that should persist')

    // Get subgraph node
    const subgraphNode = await comfyPage.getNodeRefById('11')

    // Navigate into subgraph
    await navigateIntoSubgraph(comfyPage, subgraphNode)

    // Verify content is still there
    const subgraphTextarea = await comfyPage.page.locator(
      '.comfy-multiline-input'
    )
    await expect(subgraphTextarea).toHaveValue(
      'Test content that should persist'
    )

    // Navigate back
    await comfyPage.page.keyboard.press('Escape')
    await comfyPage.nextFrame()

    // Verify content persisted
    const parentTextarea = await comfyPage.page.locator(
      '.comfy-multiline-input'
    )
    await expect(parentTextarea).toHaveValue('Test content that should persist')
  })

  test('DOM elements are cleaned up when subgraph node is removed', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('subgraph-with-promoted-text-widget')

    // Count initial DOM elements
    const initialCount = await comfyPage.page
      .locator('.comfy-multiline-input')
      .count()
    expect(initialCount).toBe(1)

    // Get subgraph node
    const subgraphNode = await comfyPage.getNodeRefById('11')

    // Select and delete the subgraph node
    await subgraphNode.click('title')
    await comfyPage.page.keyboard.press('Delete')
    await comfyPage.nextFrame()

    // Verify DOM elements are cleaned up
    const finalCount = await comfyPage.page
      .locator('.comfy-multiline-input')
      .count()
    expect(finalCount).toBe(0)
  })

  test('DOM elements are cleaned up when widget is disconnected from I/O', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('subgraph-with-promoted-text-widget')

    // Verify initial state - promoted widget exists
    const textareaCount = await comfyPage.page
      .locator('.comfy-multiline-input')
      .count()
    expect(textareaCount).toBe(1)

    // Get subgraph node
    const subgraphNode = await comfyPage.getNodeRefById('11')

    // Navigate into subgraph with retry logic (DOM widget might interfere)
    await navigateIntoSubgraphWithRetry(comfyPage, subgraphNode)

    // Count DOM widgets before removing the slot
    const beforeRemovalCount = await comfyPage.page
      .locator('.comfy-multiline-input')
      .count()

    // Right-click on the "text" input slot (the one connected to the DOM widget)
    await comfyPage.rightClickSubgraphInputSlot('text')

    // Click "Remove Slot" in the litegraph context menu
    await comfyPage.clickLitegraphContextMenuItem('Remove Slot')

    await comfyPage.page.waitForTimeout(200)

    // Navigate back to parent
    await comfyPage.page.keyboard.press('Escape')
    await comfyPage.nextFrame()

    await comfyPage.page.waitForTimeout(200)

    // Verify the promoted widget is actually removed from the subgraph node
    const widgetRemoved = await comfyPage.page.evaluate(() => {
      const subgraphNode = window['app'].canvas.graph.getNodeById(11)
      if (!subgraphNode) {
        throw new Error('Subgraph node not found')
      }

      // Check if the subgraph node still has any promoted widgets
      const hasPromotedWidgets =
        subgraphNode.widgets && subgraphNode.widgets.length > 0

      // Also check the subgraph's inputs to see if the text input was actually removed
      const hasTextInput = subgraphNode.subgraph?.inputs?.some(
        (input) => input.name === 'text'
      )

      return {
        nodeWidgetCount: subgraphNode.widgets?.length || 0,
        hasTextInput: !!hasTextInput,
        inputCount: subgraphNode.subgraph?.inputs?.length || 0
      }
    })

    // The subgraph node should no longer have any promoted widgets
    expect(widgetRemoved.nodeWidgetCount).toBe(0)

    // The text input should be removed from the subgraph
    expect(widgetRemoved.hasTextInput).toBe(false)
  })

  test('Multiple promoted widgets are handled correctly', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('subgraph-with-multiple-promoted-widgets')

    // Count widgets in parent view
    const parentCount = await comfyPage.page
      .locator('.comfy-multiline-input')
      .count()
    expect(parentCount).toBeGreaterThan(1) // Should have multiple widgets

    // Get subgraph node
    const subgraphNode = await comfyPage.getNodeRefById('11')

    // Navigate into subgraph
    await navigateIntoSubgraph(comfyPage, subgraphNode)

    // Count should be the same in subgraph
    const subgraphCount = await comfyPage.page
      .locator('.comfy-multiline-input')
      .count()
    expect(subgraphCount).toBe(parentCount)

    // Navigate back
    await comfyPage.page.keyboard.press('Escape')
    await comfyPage.nextFrame()

    // Count should still be the same
    const finalCount = await comfyPage.page
      .locator('.comfy-multiline-input')
      .count()
    expect(finalCount).toBe(parentCount)
  })
})
