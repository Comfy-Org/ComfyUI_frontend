import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './ComfyPage'

test.describe('Node search box', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting(
      'Comfy.NodeSearchBoxImpl.LinkReleaseAction',
      'search box'
    )
    await comfyPage.setSetting(
      'Comfy.NodeSearchBoxImpl.LinkReleaseActionShift',
      'search box'
    )
    await comfyPage.setSetting('Comfy.NodeSearchBoxImpl', 'default')
  })

  test(`Can trigger on empty canvas double click`, async ({ comfyPage }) => {
    await comfyPage.doubleClickCanvas()
    await expect(comfyPage.searchBox.input).toHaveCount(1)
  })

  test('Can trigger on link release', async ({ comfyPage }) => {
    await comfyPage.disconnectEdge()
    await expect(comfyPage.searchBox.input).toHaveCount(1)
  })

  test('Can add node', async ({ comfyPage }) => {
    await comfyPage.doubleClickCanvas()
    await expect(comfyPage.searchBox.input).toHaveCount(1)
    await comfyPage.searchBox.fillAndSelectFirstNode('KSampler')
    await expect(comfyPage.canvas).toHaveScreenshot('added-node.png')
  })

  test('Can auto link node', async ({ comfyPage }) => {
    await comfyPage.disconnectEdge()
    // Select the second item as the first item is always reroute
    await comfyPage.searchBox.fillAndSelectFirstNode('CLIPTextEncode', {
      suggestionIndex: 0
    })
    await expect(comfyPage.canvas).toHaveScreenshot('auto-linked-node.png')
  })

  test('Can auto link batch moved node', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('batch_move_links')

    const outputSlot1Pos = {
      x: 304,
      y: 127
    }
    const emptySpacePos = {
      x: 5,
      y: 5
    }
    await comfyPage.page.keyboard.down('Shift')
    await comfyPage.dragAndDrop(outputSlot1Pos, emptySpacePos)
    await comfyPage.page.keyboard.up('Shift')

    // Select the second item as the first item is always reroute
    await comfyPage.searchBox.fillAndSelectFirstNode('Load Checkpoint', {
      suggestionIndex: 0
    })
    await expect(comfyPage.canvas).toHaveScreenshot(
      'auto-linked-node-batch.png'
    )
  })

  test('Link release connecting to node with no slots', async ({
    comfyPage
  }) => {
    await comfyPage.disconnectEdge()
    await expect(comfyPage.searchBox.input).toHaveCount(1)
    await comfyPage.page.locator('.p-chip-remove-icon').click()
    await comfyPage.searchBox.fillAndSelectFirstNode('KSampler')
    await expect(comfyPage.canvas).toHaveScreenshot(
      'added-node-no-connection.png'
    )
  })
})

test.describe('Release context menu', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting(
      'Comfy.NodeSearchBoxImpl.LinkReleaseAction',
      'context menu'
    )
    await comfyPage.setSetting(
      'Comfy.NodeSearchBoxImpl.LinkReleaseActionShift',
      'search box'
    )
    await comfyPage.setSetting('Comfy.NodeSearchBoxImpl', 'default')
  })

  test('Can trigger on link release', async ({ comfyPage }) => {
    await comfyPage.disconnectEdge()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'link-release-context-menu.png'
    )
  })
})
