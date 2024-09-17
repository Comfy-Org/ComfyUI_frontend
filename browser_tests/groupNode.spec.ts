import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './ComfyPage'

test.describe('Group Node', () => {
  test('Can be added with search', async ({ comfyPage }) => {
    const groupNodeName = 'DefautWorkflowGroupNode'
    await comfyPage.convertAllNodesToGroupNode(groupNodeName)
    await comfyPage.doubleClickCanvas()
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
