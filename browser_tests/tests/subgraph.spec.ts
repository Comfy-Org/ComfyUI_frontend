import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

// Constants
const RENAMED_INPUT_NAME = 'renamed_input'
const NEW_SUBGRAPH_TITLE = 'New Subgraph'
const UPDATED_SUBGRAPH_TITLE = 'Updated Subgraph Title'
const TEST_WIDGET_CONTENT = 'Test content that should persist'

// Common selectors
const SELECTORS = {
  breadcrumb: '.subgraph-breadcrumb',
  promptDialog: '.graphdialog input',
  nodeSearchContainer: '.node-search-container',
  domWidget: '.comfy-multiline-input'
} as const

test.describe('Subgraph Operations', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
  })

  // Helper to get subgraph slot count
  async function getSubgraphSlotCount(
    comfyPage: typeof test.prototype.comfyPage,
    type: 'inputs' | 'outputs'
  ): Promise<number> {
    return await comfyPage.page.evaluate((slotType) => {
      return window['app'].canvas.graph[slotType]?.length || 0
    }, type)
  }

  // Helper to get current graph node count
  async function getGraphNodeCount(
    comfyPage: typeof test.prototype.comfyPage
  ): Promise<number> {
    return await comfyPage.page.evaluate(() => {
      return window['app'].canvas.graph.nodes?.length || 0
    })
  }

  // Helper to verify we're in a subgraph
  async function isInSubgraph(
    comfyPage: typeof test.prototype.comfyPage
  ): Promise<boolean> {
    return await comfyPage.page.evaluate(() => {
      const graph = window['app'].canvas.graph
      return graph?.constructor?.name === 'Subgraph'
    })
  }

  test.describe('I/O Slot Management', () => {
    test('Can add input slots to subgraph', async ({ comfyPage }) => {
      await comfyPage.loadWorkflow('basic-subgraph')

      const subgraphNode = await comfyPage.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialCount = await getSubgraphSlotCount(comfyPage, 'inputs')
      const vaeEncodeNode = await comfyPage.getNodeRefById('2')

      await comfyPage.connectFromSubgraphInput(vaeEncodeNode, 0)
      await comfyPage.nextFrame()

      const finalCount = await getSubgraphSlotCount(comfyPage, 'inputs')
      expect(finalCount).toBe(initialCount + 1)
    })

    test('Can add output slots to subgraph', async ({ comfyPage }) => {
      await comfyPage.loadWorkflow('basic-subgraph')

      const subgraphNode = await comfyPage.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialCount = await getSubgraphSlotCount(comfyPage, 'outputs')
      const vaeEncodeNode = await comfyPage.getNodeRefById('2')

      await comfyPage.connectToSubgraphOutput(vaeEncodeNode, 0)
      await comfyPage.nextFrame()

      const finalCount = await getSubgraphSlotCount(comfyPage, 'outputs')
      expect(finalCount).toBe(initialCount + 1)
    })

    test('Can remove input slots from subgraph', async ({ comfyPage }) => {
      await comfyPage.loadWorkflow('basic-subgraph')

      const subgraphNode = await comfyPage.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialCount = await getSubgraphSlotCount(comfyPage, 'inputs')
      expect(initialCount).toBeGreaterThan(0)

      await comfyPage.rightClickSubgraphInputSlot()
      await comfyPage.clickLitegraphContextMenuItem('Remove Slot')

      // Force re-render
      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()

      const finalCount = await getSubgraphSlotCount(comfyPage, 'inputs')
      expect(finalCount).toBe(initialCount - 1)
    })

    test('Can remove output slots from subgraph', async ({ comfyPage }) => {
      await comfyPage.loadWorkflow('basic-subgraph')

      const subgraphNode = await comfyPage.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialCount = await getSubgraphSlotCount(comfyPage, 'outputs')
      expect(initialCount).toBeGreaterThan(0)

      await comfyPage.rightClickSubgraphOutputSlot()
      await comfyPage.clickLitegraphContextMenuItem('Remove Slot')

      // Force re-render
      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()

      const finalCount = await getSubgraphSlotCount(comfyPage, 'outputs')
      expect(finalCount).toBe(initialCount - 1)
    })

    test('Can rename I/O slots', async ({ comfyPage }) => {
      await comfyPage.loadWorkflow('basic-subgraph')

      const subgraphNode = await comfyPage.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialInputLabel = await comfyPage.page.evaluate(() => {
        const graph = window['app'].canvas.graph
        return graph.inputs?.[0]?.label || null
      })

      await comfyPage.rightClickSubgraphInputSlot(initialInputLabel)
      await comfyPage.clickLitegraphContextMenuItem('Rename Slot')

      await comfyPage.page.waitForSelector(SELECTORS.promptDialog, {
        state: 'visible'
      })
      await comfyPage.page.fill(SELECTORS.promptDialog, RENAMED_INPUT_NAME)
      await comfyPage.page.keyboard.press('Enter')

      // Force re-render
      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()

      const newInputName = await comfyPage.page.evaluate(() => {
        const graph = window['app'].canvas.graph
        return graph.inputs?.[0]?.label || null
      })

      expect(newInputName).toBe(RENAMED_INPUT_NAME)
      expect(newInputName).not.toBe(initialInputLabel)
    })
  })

  test.describe('Subgraph Creation and Deletion', () => {
    test('Can create subgraph from selected nodes', async ({ comfyPage }) => {
      await comfyPage.loadWorkflow('default')

      const initialNodeCount = await getGraphNodeCount(comfyPage)

      await comfyPage.ctrlA()
      await comfyPage.nextFrame()

      const node = await comfyPage.getNodeRefById('5')
      await node.convertToSubgraph()
      await comfyPage.nextFrame()

      const subgraphNodes =
        await comfyPage.getNodeRefsByTitle(NEW_SUBGRAPH_TITLE)
      expect(subgraphNodes.length).toBe(1)

      const finalNodeCount = await getGraphNodeCount(comfyPage)
      expect(finalNodeCount).toBe(1)
    })

    test('Can delete subgraph node', async ({ comfyPage }) => {
      await comfyPage.loadWorkflow('basic-subgraph')

      const subgraphNode = await comfyPage.getNodeRefById('2')
      expect(await subgraphNode.exists()).toBe(true)

      const initialNodeCount = await getGraphNodeCount(comfyPage)

      await subgraphNode.click('title')
      await comfyPage.page.keyboard.press('Delete')
      await comfyPage.nextFrame()

      const finalNodeCount = await getGraphNodeCount(comfyPage)
      expect(finalNodeCount).toBe(initialNodeCount - 1)

      const deletedNode = await comfyPage.getNodeRefById('2')
      expect(await deletedNode.exists()).toBe(false)
    })
  })

  test.describe('Operations Inside Subgraphs', () => {
    test('Can copy and paste nodes in subgraph', async ({ comfyPage }) => {
      await comfyPage.loadWorkflow('basic-subgraph')

      const subgraphNode = await comfyPage.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialNodeCount = await getGraphNodeCount(comfyPage)

      const nodesInSubgraph = await comfyPage.page.evaluate(() => {
        const nodes = window['app'].canvas.graph.nodes
        return nodes?.[0]?.id || null
      })

      expect(nodesInSubgraph).not.toBeNull()

      const nodeToClone = await comfyPage.getNodeRefById(
        String(nodesInSubgraph)
      )
      await nodeToClone.click('title')
      await comfyPage.nextFrame()

      await comfyPage.page.keyboard.press('Control+c')
      await comfyPage.nextFrame()

      await comfyPage.page.keyboard.press('Control+v')
      await comfyPage.nextFrame()

      const finalNodeCount = await getGraphNodeCount(comfyPage)
      expect(finalNodeCount).toBe(initialNodeCount + 1)
    })

    test('Can undo and redo operations in subgraph', async ({ comfyPage }) => {
      await comfyPage.loadWorkflow('basic-subgraph')

      const subgraphNode = await comfyPage.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      // Add a node
      await comfyPage.doubleClickCanvas()
      await comfyPage.searchBox.fillAndSelectFirstNode('Note')
      await comfyPage.nextFrame()

      // Get initial node count
      const initialCount = await getGraphNodeCount(comfyPage)

      // Undo
      await comfyPage.ctrlZ()
      await comfyPage.nextFrame()

      const afterUndoCount = await getGraphNodeCount(comfyPage)
      expect(afterUndoCount).toBe(initialCount - 1)

      // Redo
      await comfyPage.ctrlY()
      await comfyPage.nextFrame()

      const afterRedoCount = await getGraphNodeCount(comfyPage)
      expect(afterRedoCount).toBe(initialCount)
    })
  })

  test.describe('Subgraph Navigation and UI', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    })

    test('Breadcrumb updates when subgraph node title is changed', async ({
      comfyPage
    }) => {
      await comfyPage.loadWorkflow('nested-subgraph')
      await comfyPage.nextFrame()

      const subgraphNode = await comfyPage.getNodeRefById('10')
      const nodePos = await subgraphNode.getPosition()
      const nodeSize = await subgraphNode.getSize()

      // Navigate into subgraph
      await subgraphNode.navigateIntoSubgraph()

      await comfyPage.page.waitForSelector(SELECTORS.breadcrumb, {
        state: 'visible',
        timeout: 20000
      })

      const breadcrumb = comfyPage.page.locator(SELECTORS.breadcrumb)
      const initialBreadcrumbText = await breadcrumb.textContent()

      // Go back and edit title
      await comfyPage.page.keyboard.press('Escape')
      await comfyPage.nextFrame()

      await comfyPage.canvas.dblclick({
        position: {
          x: nodePos.x + nodeSize.width / 2,
          y: nodePos.y - 10
        },
        delay: 5
      })

      await expect(comfyPage.page.locator('.node-title-editor')).toBeVisible()

      await comfyPage.page.keyboard.press('Control+a')
      await comfyPage.page.keyboard.type(UPDATED_SUBGRAPH_TITLE)
      await comfyPage.page.keyboard.press('Enter')
      await comfyPage.nextFrame()

      // Navigate back into subgraph
      await subgraphNode.navigateIntoSubgraph()

      await comfyPage.page.waitForSelector(SELECTORS.breadcrumb)

      const updatedBreadcrumbText = await breadcrumb.textContent()
      expect(updatedBreadcrumbText).toContain(UPDATED_SUBGRAPH_TITLE)
      expect(updatedBreadcrumbText).not.toBe(initialBreadcrumbText)
    })
  })

  test.describe('DOM Widget Promotion', () => {
    test('DOM widget visibility persists through subgraph navigation', async ({
      comfyPage
    }) => {
      await comfyPage.loadWorkflow('subgraph-with-promoted-text-widget')
      await comfyPage.nextFrame()

      // Verify promoted widget is visible in parent graph
      const parentTextarea = comfyPage.page.locator(SELECTORS.domWidget)
      await expect(parentTextarea).toBeVisible()
      await expect(parentTextarea).toHaveCount(1)

      const subgraphNode = await comfyPage.getNodeRefById('11')
      expect(await subgraphNode.exists()).toBe(true)

      await subgraphNode.navigateIntoSubgraph()

      // Verify widget is visible in subgraph
      const subgraphTextarea = comfyPage.page.locator(SELECTORS.domWidget)
      await expect(subgraphTextarea).toBeVisible()
      await expect(subgraphTextarea).toHaveCount(1)

      // Navigate back
      await comfyPage.page.keyboard.press('Escape')
      await comfyPage.nextFrame()

      // Verify widget is still visible
      const backToParentTextarea = comfyPage.page.locator(SELECTORS.domWidget)
      await expect(backToParentTextarea).toBeVisible()
      await expect(backToParentTextarea).toHaveCount(1)
    })

    test('DOM widget content is preserved through navigation', async ({
      comfyPage
    }) => {
      await comfyPage.loadWorkflow('subgraph-with-promoted-text-widget')

      const textarea = comfyPage.page.locator(SELECTORS.domWidget)
      await textarea.fill(TEST_WIDGET_CONTENT)

      const subgraphNode = await comfyPage.getNodeRefById('11')
      await subgraphNode.navigateIntoSubgraph()

      const subgraphTextarea = comfyPage.page.locator(SELECTORS.domWidget)
      await expect(subgraphTextarea).toHaveValue(TEST_WIDGET_CONTENT)

      await comfyPage.page.keyboard.press('Escape')
      await comfyPage.nextFrame()

      const parentTextarea = comfyPage.page.locator(SELECTORS.domWidget)
      await expect(parentTextarea).toHaveValue(TEST_WIDGET_CONTENT)
    })

    test('DOM elements are cleaned up when subgraph node is removed', async ({
      comfyPage
    }) => {
      await comfyPage.loadWorkflow('subgraph-with-promoted-text-widget')

      const initialCount = await comfyPage.page
        .locator(SELECTORS.domWidget)
        .count()
      expect(initialCount).toBe(1)

      const subgraphNode = await comfyPage.getNodeRefById('11')

      await subgraphNode.click('title')
      await comfyPage.page.keyboard.press('Delete')
      await comfyPage.nextFrame()

      const finalCount = await comfyPage.page
        .locator(SELECTORS.domWidget)
        .count()
      expect(finalCount).toBe(0)
    })

    test('DOM elements are cleaned up when widget is disconnected from I/O', async ({
      comfyPage
    }) => {
      // Enable new menu for breadcrumb navigation
      await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')

      const workflowName = 'subgraph-with-promoted-text-widget'
      await comfyPage.loadWorkflow(workflowName)

      const textareaCount = await comfyPage.page
        .locator(SELECTORS.domWidget)
        .count()
      expect(textareaCount).toBe(1)

      const subgraphNode = await comfyPage.getNodeRefById('11')

      // Navigate into subgraph (method now handles retries internally)
      await subgraphNode.navigateIntoSubgraph()

      await comfyPage.rightClickSubgraphInputSlot('text')
      await comfyPage.clickLitegraphContextMenuItem('Remove Slot')
      await comfyPage.page.waitForTimeout(200)

      // Wait for breadcrumb to be visible
      await comfyPage.page.waitForSelector(SELECTORS.breadcrumb, {
        state: 'visible',
        timeout: 5000
      })

      // Click breadcrumb to navigate back to parent graph
      const homeBreadcrumb = comfyPage.page.getByRole('link', {
        // In the subgraph navigation breadcrumbs, the home/top level
        // breadcrumb is just the workflow name
        name: workflowName
      })
      await homeBreadcrumb.waitFor({ state: 'visible' })
      await homeBreadcrumb.click()
      await comfyPage.nextFrame()
      await comfyPage.page.waitForTimeout(300)

      // Check that the subgraph node has no widgets after removing the text slot
      const widgetCount = await comfyPage.page.evaluate(() => {
        return window['app'].canvas.graph.nodes[0].widgets?.length || 0
      })

      expect(widgetCount).toBe(0)
    })

    test('Multiple promoted widgets are handled correctly', async ({
      comfyPage
    }) => {
      await comfyPage.loadWorkflow('subgraph-with-multiple-promoted-widgets')

      const parentCount = await comfyPage.page
        .locator(SELECTORS.domWidget)
        .count()
      expect(parentCount).toBeGreaterThan(1)

      const subgraphNode = await comfyPage.getNodeRefById('11')
      await subgraphNode.navigateIntoSubgraph()

      const subgraphCount = await comfyPage.page
        .locator(SELECTORS.domWidget)
        .count()
      expect(subgraphCount).toBe(parentCount)

      await comfyPage.page.keyboard.press('Escape')
      await comfyPage.nextFrame()

      const finalCount = await comfyPage.page
        .locator(SELECTORS.domWidget)
        .count()
      expect(finalCount).toBe(parentCount)
    })
  })
})
