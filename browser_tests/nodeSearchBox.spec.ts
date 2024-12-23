import {
  comfyPageFixture as test,
  comfyExpect as expect
} from './fixtures/ComfyPage'

test.describe('Node search box', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.LinkRelease.Action', 'search box')
    await comfyPage.setSetting('Comfy.LinkRelease.ActionShift', 'search box')
    await comfyPage.setSetting('Comfy.NodeSearchBoxImpl', 'default')
  })

  test(`Can trigger on empty canvas double click`, async ({ comfyPage }) => {
    await comfyPage.doubleClickCanvas()
    await expect(comfyPage.searchBox.input).toHaveCount(1)
  })

  test(`Can trigger on group body double click`, async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('single_group_only')
    await comfyPage.page.mouse.dblclick(50, 50, { delay: 5 })
    await comfyPage.nextFrame()
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

  test('Has correct aria-labels on search results', async ({ comfyPage }) => {
    const node = 'Load Checkpoint'
    await comfyPage.doubleClickCanvas()
    await comfyPage.searchBox.fillAndSelectFirstNode(node)
    const firstResult = comfyPage.page
      .locator('li.p-autocomplete-option')
      .first()
    await expect(firstResult).toHaveAttribute('aria-label', node)
  })

  test('@mobile Can trigger on empty canvas tap', async ({ comfyPage }) => {
    await comfyPage.closeMenu()
    await comfyPage.loadWorkflow('single_ksampler')
    const screenCenter = {
      x: 200,
      y: 400
    }
    await comfyPage.canvas.tap({
      position: screenCenter
    })
    await comfyPage.canvas.tap({
      position: screenCenter
    })
    await comfyPage.page.waitForTimeout(256)
    await expect(comfyPage.searchBox.input).not.toHaveCount(0)
  })

  test.describe('Filtering', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.doubleClickCanvas()
    })

    test('Can add filter', async ({ comfyPage }) => {
      await comfyPage.searchBox.addFilter('MODEL', 'Input Type')
      await expect(comfyPage.searchBox.filterChips).toHaveCount(1)
    })

    test('Can add multiple filters', async ({ comfyPage }) => {
      await comfyPage.searchBox.addFilter('MODEL', 'Input Type')
      await comfyPage.searchBox.addFilter('CLIP', 'Output Type')
      await expect(comfyPage.searchBox.filterChips).toHaveCount(2)
    })

    test('Can remove filter', async ({ comfyPage }) => {
      await comfyPage.searchBox.addFilter('MODEL', 'Input Type')
      await comfyPage.searchBox.addFilter('CLIP', 'Output Type')
      await comfyPage.searchBox.removeFilter(0)
      await expect(comfyPage.searchBox.filterChips).toHaveCount(1)
    })
  })

  test.describe('Input focus behavior', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.doubleClickCanvas()
    })

    test('focuses input after adding a filter', async ({ comfyPage }) => {
      await comfyPage.searchBox.addFilter('MODEL', 'Input Type')
      await expect(comfyPage.searchBox.input).toHaveFocus()
    })

    test('focuses input after removing a filter', async ({ comfyPage }) => {
      await comfyPage.searchBox.addFilter('MODEL', 'Input Type')
      await comfyPage.searchBox.removeFilter(0)
      await expect(comfyPage.searchBox.input).toHaveFocus()
    })
  })
})

test.describe('Release context menu', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.LinkRelease.Action', 'context menu')
    await comfyPage.setSetting('Comfy.LinkRelease.ActionShift', 'search box')
    await comfyPage.setSetting('Comfy.NodeSearchBoxImpl', 'default')
  })

  test('Can trigger on link release', async ({ comfyPage }) => {
    await comfyPage.disconnectEdge()
    await comfyPage.page.mouse.move(10, 10)
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'link-release-context-menu.png'
    )
  })
})
