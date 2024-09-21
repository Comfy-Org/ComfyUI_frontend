import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './ComfyPage'

test.describe('Group Node', () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
  })

  test('Is added to node library sidebar', async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    const groupNodeName = 'DefautWorkflowGroupNode'
    await comfyPage.convertAllNodesToGroupNode(groupNodeName)
    const tab = comfyPage.menu.nodeLibraryTab
    await tab.open()
    expect(await tab.getFolder('group nodes').count()).toBe(1)
  })

  test('Can be added to canvas using node library sidebar', async ({
    comfyPage
  }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    const groupNodeName = 'DefautWorkflowGroupNode'
    await comfyPage.convertAllNodesToGroupNode(groupNodeName)
    const initialNodeCount = await comfyPage.getGraphNodesCount()

    // Add group node from node library sidebar
    const tab = comfyPage.menu.nodeLibraryTab
    await tab.open()
    await tab.getFolder('group nodes').click()
    await tab.getFolder('workflow').click()
    await tab.getFolder('workflow').last().click()
    await tab.getNode(groupNodeName).click()

    // Verify the node is added to the canvas
    expect(await comfyPage.getGraphNodesCount()).toBe(initialNodeCount + 1)
  })

  test('Can be added to canvas using search', async ({ comfyPage }) => {
    const groupNodeName = 'DefautWorkflowGroupNode'
    await comfyPage.convertAllNodesToGroupNode(groupNodeName)
    await comfyPage.doubleClickCanvas()
    await comfyPage.nextFrame()
    await comfyPage.searchBox.fillAndSelectFirstNode(groupNodeName)
    await expect(comfyPage.canvas).toHaveScreenshot(
      'group-node-copy-added-from-search.png'
    )
  })

  test('Displays tooltip on title hover', async ({ comfyPage }) => {
    await comfyPage.convertAllNodesToGroupNode('Group Node')
    await comfyPage.page.mouse.move(47, 173)
    const tooltipTimeout = 500
    await comfyPage.page.waitForTimeout(tooltipTimeout + 16)
    await expect(comfyPage.page.locator('.node-tooltip')).toBeVisible()
  })
})
