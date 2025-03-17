import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'

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
    await comfyPage.searchBox.input.waitFor({ state: 'visible' })
    await comfyPage.searchBox.input.fill(node)
    await comfyPage.searchBox.dropdown.waitFor({ state: 'visible' })
    // Wait for some time for the auto complete list to update.
    // The auto complete list is debounced and may take some time to update.
    await comfyPage.page.waitForTimeout(500)

    const firstResult = comfyPage.searchBox.dropdown.locator('li').first()
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
    const expectFilterChips = async (comfyPage, expectedTexts: string[]) => {
      const chips = comfyPage.searchBox.filterChips

      // Check that the number of chips matches the expected count
      await expect(chips).toHaveCount(expectedTexts.length)

      // Verify the text and visibility of each filter chip
      await Promise.all(
        expectedTexts.map(async (text, index) => {
          const chip = chips.nth(index)
          await expect(chip).toContainText(text)
          await expect(chip).toBeVisible()
        })
      )
    }

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.doubleClickCanvas()
    })

    test('Can add filter', async ({ comfyPage }) => {
      await comfyPage.searchBox.addFilter('MODEL', 'Input Type')
      await expectFilterChips(comfyPage, ['MODEL'])
    })

    // Flaky test.
    // Sample test failure:
    // https://github.com/Comfy-Org/ComfyUI_frontend/actions/runs/12696912248/job/35391990861?pr=2210
    /*
    1) [chromium-2x] › nodeSearchBox.spec.ts:135:5 › Node search box › Filtering › Outer click dismisses filter panel but keeps search box visible

    Error: expect(locator).not.toBeVisible()

    Locator: getByRole('dialog').locator('div').filter({ hasText: 'Add node filter condition' })
    Expected: not visible
    Received: visible
    Call log:
      - expect.not.toBeVisible with timeout 5000ms
      - waiting for getByRole('dialog').locator('div').filter({ hasText: 'Add node filter condition' })


      143 |
      144 |       // Verify the filter selection panel is hidden
    > 145 |       expect(panel.header).not.toBeVisible()
          |                                ^
      146 |
      147 |       // Verify the node search dialog is still visible
      148 |       expect(comfyPage.searchBox.input).toBeVisible()

        at /home/runner/work/ComfyUI_frontend/ComfyUI_frontend/ComfyUI_frontend/browser_tests/nodeSearchBox.spec.ts:145:32
     */
    test.skip('Outer click dismisses filter panel but keeps search box visible', async ({
      comfyPage
    }) => {
      await comfyPage.searchBox.filterButton.click()
      const panel = comfyPage.searchBox.filterSelectionPanel
      await panel.header.waitFor({ state: 'visible' })
      const panelBounds = await panel.header.boundingBox()
      await comfyPage.page.mouse.click(panelBounds!.x - 10, panelBounds!.y - 10)

      // Verify the filter selection panel is hidden
      expect(panel.header).not.toBeVisible()

      // Verify the node search dialog is still visible
      expect(comfyPage.searchBox.input).toBeVisible()
    })

    test('Can add multiple filters', async ({ comfyPage }) => {
      await comfyPage.searchBox.addFilter('MODEL', 'Input Type')
      await comfyPage.searchBox.addFilter('CLIP', 'Output Type')
      await expectFilterChips(comfyPage, ['MODEL', 'CLIP'])
    })

    test('Can remove filter', async ({ comfyPage }) => {
      await comfyPage.searchBox.addFilter('MODEL', 'Input Type')
      await comfyPage.searchBox.removeFilter(0)
      await expectFilterChips(comfyPage, [])
    })

    test.describe('Removing from multiple filters', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.searchBox.addFilter('MODEL', 'Input Type')
        await comfyPage.searchBox.addFilter('CLIP', 'Output Type')
        await comfyPage.searchBox.addFilter('utils', 'Category')
      })

      test('Can remove first filter', async ({ comfyPage }) => {
        await comfyPage.searchBox.removeFilter(0)
        await expectFilterChips(comfyPage, ['CLIP', 'utils'])
        await comfyPage.searchBox.removeFilter(0)
        await expectFilterChips(comfyPage, ['utils'])
        await comfyPage.searchBox.removeFilter(0)
        await expectFilterChips(comfyPage, [])
      })

      test('Can remove middle filter', async ({ comfyPage }) => {
        await comfyPage.searchBox.removeFilter(1)
        await expectFilterChips(comfyPage, ['MODEL', 'utils'])
      })

      test('Can remove last filter', async ({ comfyPage }) => {
        await comfyPage.searchBox.removeFilter(2)
        await expectFilterChips(comfyPage, ['MODEL', 'CLIP'])
      })
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
