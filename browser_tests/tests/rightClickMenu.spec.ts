import { expect } from '@playwright/test'

import { NodeBadgeMode } from '../../src/types/nodeSource'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Canvas Right Click Menu', () => {
  test('Can add node', async ({ comfyPage }) => {
    await comfyPage.rightClickCanvas()
    await expect(comfyPage.canvas).toHaveScreenshot('right-click-menu.png')
    await comfyPage.page.getByText('Add Node').click()
    await comfyPage.nextFrame()
    await comfyPage.page.getByText('loaders').click()
    await comfyPage.nextFrame()
    await comfyPage.page.getByText('Load VAE').click()
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot('add-node-node-added.png')
  })

  test('Can add group', async ({ comfyPage }) => {
    await comfyPage.rightClickCanvas()
    await expect(comfyPage.canvas).toHaveScreenshot('right-click-menu.png')
    await comfyPage.page.getByText('Add Group', { exact: true }).click()
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot('add-group-group-added.png')
  })

  test('Can convert to group node', async ({ comfyPage }) => {
    await comfyPage.select2Nodes()
    await expect(comfyPage.canvas).toHaveScreenshot('selected-2-nodes.png')
    await comfyPage.rightClickCanvas()
    await comfyPage.clickContextMenuItem('Convert to Group Node')
    await comfyPage.promptDialogInput.fill('GroupNode2CLIP')
    await comfyPage.page.keyboard.press('Enter')
    await comfyPage.promptDialogInput.waitFor({ state: 'hidden' })
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'right-click-node-group-node.png'
    )
  })
})

test.describe('Node Right Click Menu', () => {
  test('Can open properties panel', async ({ comfyPage }) => {
    await comfyPage.rightClickEmptyLatentNode()
    await expect(comfyPage.canvas).toHaveScreenshot('right-click-node.png')
    await comfyPage.page.getByText('Properties Panel').click()
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'right-click-node-properties-panel.png'
    )
  })

  test('Can collapse', async ({ comfyPage }) => {
    await comfyPage.rightClickEmptyLatentNode()
    await expect(comfyPage.canvas).toHaveScreenshot('right-click-node.png')
    await comfyPage.page.getByText('Collapse').click()
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'right-click-node-collapsed.png'
    )
  })

  test('Can collapse (Node Badge)', async ({ comfyPage }) => {
    await comfyPage.setSetting(
      'Comfy.NodeBadge.NodeIdBadgeMode',
      NodeBadgeMode.ShowAll
    )
    await comfyPage.setSetting(
      'Comfy.NodeBadge.NodeSourceBadgeMode',
      NodeBadgeMode.ShowAll
    )

    await comfyPage.rightClickEmptyLatentNode()
    await comfyPage.page.getByText('Collapse').click()
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'right-click-node-collapsed-badge.png'
    )
  })

  test('Can bypass', async ({ comfyPage }) => {
    await comfyPage.rightClickEmptyLatentNode()
    await expect(comfyPage.canvas).toHaveScreenshot('right-click-node.png')
    await comfyPage.page.getByText('Bypass').click()
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'right-click-node-bypassed.png'
    )
  })

  test.describe('Widget conversion', () => {
    const convertibleWidgetTypes = ['text', 'string', 'number', 'toggle']

    test('Can convert widget to input', async ({ comfyPage }) => {
      await comfyPage.rightClickEmptyLatentNode()
      await expect(comfyPage.canvas).toHaveScreenshot('right-click-node.png')
      await comfyPage.page.getByText('Convert Widget to Input').click()
      await comfyPage.nextFrame()
      // The submenu has an identical entry as the base menu - use last
      await comfyPage.page.getByText('Convert width to input').last().click()
      await comfyPage.nextFrame()
      await expect(comfyPage.canvas).toHaveScreenshot(
        'right-click-node-widget-converted.png'
      )
    })

    test('Can convert widget without submenu', async ({ comfyPage }) => {
      // Right-click the width widget
      await comfyPage.rightClickEmptyLatentNode()
      await expect(comfyPage.canvas).toHaveScreenshot('right-click-node.png')
      await comfyPage.page.getByText('Convert width to input').click()
      await comfyPage.nextFrame()
      await expect(comfyPage.canvas).toHaveScreenshot(
        'right-click-node-widget-converted.png'
      )
    })

    convertibleWidgetTypes.forEach((widgetType) => {
      test(`Can convert ${widgetType} widget to input`, async ({
        comfyPage
      }) => {
        const nodeType = 'KSampler'

        // To avoid needing multiple clicks, disable nesting of conversion options
        await comfyPage.setSetting('Comfy.NodeInputConversionSubmenus', false)

        // Add the widget using the node's `addWidget` method
        await comfyPage.page.evaluate(
          ([nodeType, widgetType]) => {
            const node = window['app'].graph.nodes.find(
              (n) => n.type === nodeType
            )
            node.addWidget(widgetType, widgetType, 'defaultValue', () => {}, {})
          },
          [nodeType, widgetType]
        )

        // Verify the context menu includes the conversion option
        const node = (await comfyPage.getNodeRefsByType(nodeType))[0]
        const menuOptions = await node.getContextMenuOptionNames()
        expect(menuOptions.includes(`Convert ${widgetType} to input`)).toBe(
          true
        )
      })
    })
  })

  test('Can pin and unpin', async ({ comfyPage }) => {
    await comfyPage.rightClickEmptyLatentNode()
    await expect(comfyPage.canvas).toHaveScreenshot('right-click-node.png')
    await comfyPage.page.click('.litemenu-entry:has-text("Pin")')
    await comfyPage.nextFrame()
    await comfyPage.dragAndDrop({ x: 621, y: 617 }, { x: 16, y: 16 })
    await expect(comfyPage.canvas).toHaveScreenshot('node-pinned.png')
    await comfyPage.rightClickEmptyLatentNode()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'right-click-pinned-node.png'
    )
    await comfyPage.page.click('.litemenu-entry:has-text("Unpin")')
    await comfyPage.nextFrame()
    await comfyPage.rightClickEmptyLatentNode()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'right-click-unpinned-node.png'
    )
  })

  test('Can move after unpin', async ({ comfyPage }) => {
    await comfyPage.rightClickEmptyLatentNode()
    await comfyPage.page.click('.litemenu-entry:has-text("Pin")')
    await comfyPage.nextFrame()
    await comfyPage.rightClickEmptyLatentNode()
    await comfyPage.page.click('.litemenu-entry:has-text("Unpin")')
    await comfyPage.nextFrame()
    await comfyPage.page.waitForTimeout(256)
    await comfyPage.dragAndDrop({ x: 496, y: 618 }, { x: 200, y: 590 })
    await expect(comfyPage.canvas).toHaveScreenshot(
      'right-click-unpinned-node-moved.png'
    )
  })

  test('Can pin/unpin selected nodes', async ({ comfyPage }) => {
    await comfyPage.select2Nodes()
    await comfyPage.page.keyboard.down('Control')
    await comfyPage.rightClickEmptyLatentNode()
    await comfyPage.page.click('.litemenu-entry:has-text("Pin")')
    await comfyPage.page.keyboard.up('Control')
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot('selected-nodes-pinned.png')
    await comfyPage.rightClickEmptyLatentNode()
    await comfyPage.page.click('.litemenu-entry:has-text("Unpin")')
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'selected-nodes-unpinned.png'
    )
  })

  test('Can clone pinned nodes', async ({ comfyPage }) => {
    const nodeCount = await comfyPage.getGraphNodesCount()
    const node = (await comfyPage.getFirstNodeRef())!
    await node.clickContextMenuOption('Pin')
    await comfyPage.nextFrame()
    await node.click('title', { button: 'right' })
    await expect(
      comfyPage.page.locator('.litemenu-entry:has-text("Unpin")')
    ).toBeAttached()
    const cloneItem = comfyPage.page.locator(
      '.litemenu-entry:has-text("Clone")'
    )
    await cloneItem.click()
    await expect(cloneItem).toHaveCount(0)
    await comfyPage.nextFrame()
    expect(await comfyPage.getGraphNodesCount()).toBe(nodeCount + 1)
  })
})
