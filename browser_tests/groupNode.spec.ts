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

  test('Reconnects inputs after configuration changed via manage dialog save', async ({
    comfyPage
  }) => {
    const expectSingleNode = async (type: string) => {
      const nodes = await comfyPage.getNodeRefsByType(type)
      expect(nodes).toHaveLength(1)
      return nodes[0]
    }
    const latent = await expectSingleNode('EmptyLatentImage')
    const sampler = await expectSingleNode('KSampler')
    // Remove existing link
    const samplerInput = await sampler.getInput(0)
    await samplerInput.removeLinks()
    // Group latent + sampler
    await latent.click('title', {
      modifiers: ['Shift']
    })
    await sampler.click('title', {
      modifiers: ['Shift']
    })
    const groupNode = await sampler.convertToGroupNode()
    // Connect node to group
    const ckpt = await expectSingleNode('CheckpointLoaderSimple')
    const input = await ckpt.connectOutput(0, groupNode, 0)
    expect(await input.getLinkCount()).toBe(1)
    // Modify the group node via manage dialog
    const manage = await groupNode.manageGroupNode()
    await manage.selectNode('KSampler')
    await manage.changeTab('Inputs')
    await manage.setLabel('model', 'test')
    await manage.save()
    await manage.close()
    // Ensure the link is still present
    expect(await input.getLinkCount()).toBe(1)
  })
})
