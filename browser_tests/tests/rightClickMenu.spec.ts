import { expect } from '@playwright/test'

import { NodeBadgeMode } from '../../src/types/nodeSource'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { PerformanceMonitor } from '../helpers/performanceMonitor'

test.describe('Canvas Right Click Menu', () => {
  test.skip('@perf Can add node', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'add-node-from-menu'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('right-click-canvas', async () => {
      await comfyPage.rightClickCanvas()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('right-click-menu.png')

    await perfMonitor.measureOperation('navigate-to-node', async () => {
      await comfyPage.page.getByText('Add Node').click()
      await comfyPage.nextFrame()
      await comfyPage.page.getByText('loaders').click()
      await comfyPage.nextFrame()
      await comfyPage.page.getByText('Load VAE').click()
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('add-node-node-added.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test.skip('@perf Can add group', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'add-group-from-menu'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('right-click-canvas', async () => {
      await comfyPage.rightClickCanvas()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('right-click-menu.png')

    await perfMonitor.measureOperation('add-group', async () => {
      await comfyPage.page.getByText('Add Group', { exact: true }).click()
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('add-group-group-added.png')

    await perfMonitor.finishMonitoring(testName)
  })

  // Skip because fails with vue widget nodes (reason not investigated)
  test.skip('@perf Can convert to group node', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'convert-to-group-node'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('select-nodes', async () => {
      await comfyPage.select2Nodes()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('selected-2-nodes.png')

    await perfMonitor.measureOperation('right-click-canvas', async () => {
      await comfyPage.rightClickCanvas()
    })

    await perfMonitor.measureOperation('convert-to-group-node', async () => {
      await comfyPage.clickContextMenuItem('Convert to Group Node')
      await comfyPage.promptDialogInput.fill('GroupNode2CLIP')
      await comfyPage.page.keyboard.press('Enter')
      await comfyPage.promptDialogInput.waitFor({ state: 'hidden' })
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'right-click-node-group-node.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })
})

test.describe('Node Right Click Menu', () => {
  test.skip('@perf Can open properties panel', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'open-properties-panel'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('right-click-node', async () => {
      await comfyPage.rightClickEmptyLatentNode()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('right-click-node.png')

    await perfMonitor.measureOperation('open-properties-panel', async () => {
      await comfyPage.page.getByText('Properties Panel').click()
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'right-click-node-properties-panel.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })

  test.skip('@perf Can collapse', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'collapse-node'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('right-click-node', async () => {
      await comfyPage.rightClickEmptyLatentNode()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('right-click-node.png')

    await perfMonitor.measureOperation('collapse-node', async () => {
      await comfyPage.page.getByText('Collapse').click()
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'right-click-node-collapsed.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })

  test.skip('@perf Can collapse (Node Badge)', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'collapse-node-with-badge'

    await perfMonitor.startMonitoring(testName)

    await comfyPage.setSetting(
      'Comfy.NodeBadge.NodeIdBadgeMode',
      NodeBadgeMode.ShowAll
    )
    await comfyPage.setSetting(
      'Comfy.NodeBadge.NodeSourceBadgeMode',
      NodeBadgeMode.ShowAll
    )

    await perfMonitor.measureOperation('right-click-node', async () => {
      await comfyPage.rightClickEmptyLatentNode()
    })

    await perfMonitor.measureOperation('collapse-node-with-badge', async () => {
      await comfyPage.page.getByText('Collapse').click()
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'right-click-node-collapsed-badge.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })

  test.skip('@perf Can bypass', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'bypass-node'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('right-click-node', async () => {
      await comfyPage.rightClickEmptyLatentNode()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('right-click-node.png')

    await perfMonitor.measureOperation('bypass-node', async () => {
      await comfyPage.page.getByText('Bypass').click()
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'right-click-node-bypassed.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })

  test.skip('@perf Can pin and unpin', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'pin-unpin-node'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('right-click-node', async () => {
      await comfyPage.rightClickEmptyLatentNode()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('right-click-node.png')

    await perfMonitor.measureOperation('pin-node', async () => {
      await comfyPage.page.click('.litemenu-entry:has-text("Pin")')
      await comfyPage.nextFrame()
    })

    await perfMonitor.measureOperation('drag-pinned-node', async () => {
      await comfyPage.dragAndDrop({ x: 621, y: 617 }, { x: 16, y: 16 })
    })

    await expect(comfyPage.canvas).toHaveScreenshot('node-pinned.png')

    await perfMonitor.measureOperation('right-click-pinned-node', async () => {
      await comfyPage.rightClickEmptyLatentNode()
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'right-click-pinned-node.png'
    )

    await perfMonitor.measureOperation('unpin-node', async () => {
      await comfyPage.page.click('.litemenu-entry:has-text("Unpin")')
      await comfyPage.nextFrame()
    })

    await perfMonitor.measureOperation(
      'right-click-unpinned-node',
      async () => {
        await comfyPage.rightClickEmptyLatentNode()
      }
    )

    await expect(comfyPage.canvas).toHaveScreenshot(
      'right-click-unpinned-node.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })

  test.skip('@perf Can move after unpin', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'move-after-unpin'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('pin-node', async () => {
      await comfyPage.rightClickEmptyLatentNode()
      await comfyPage.page.click('.litemenu-entry:has-text("Pin")')
      await comfyPage.nextFrame()
    })

    await perfMonitor.measureOperation('unpin-node', async () => {
      await comfyPage.rightClickEmptyLatentNode()
      await comfyPage.page.click('.litemenu-entry:has-text("Unpin")')
      await comfyPage.nextFrame()
      await comfyPage.page.waitForTimeout(256)
    })

    await perfMonitor.measureOperation('move-unpinned-node', async () => {
      await comfyPage.dragAndDrop({ x: 496, y: 618 }, { x: 200, y: 590 })
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'right-click-unpinned-node-moved.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })

  test.skip('@perf Can pin/unpin selected nodes', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'pin-unpin-selected-nodes'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('select-multiple-nodes', async () => {
      await comfyPage.select2Nodes()
    })

    await perfMonitor.measureOperation('pin-selected-nodes', async () => {
      await comfyPage.page.keyboard.down('Control')
      await comfyPage.rightClickEmptyLatentNode()
      await comfyPage.page.click('.litemenu-entry:has-text("Pin")')
      await comfyPage.page.keyboard.up('Control')
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('selected-nodes-pinned.png')

    await perfMonitor.measureOperation('unpin-selected-nodes', async () => {
      await comfyPage.rightClickEmptyLatentNode()
      await comfyPage.page.click('.litemenu-entry:has-text("Unpin")')
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'selected-nodes-unpinned.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can clone pinned nodes', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'clone-pinned-node'

    await perfMonitor.startMonitoring(testName)

    let nodeCount: number
    await perfMonitor.measureOperation('get-initial-node-count', async () => {
      nodeCount = await comfyPage.getGraphNodesCount()
    })

    let node: any
    await perfMonitor.measureOperation('get-node-reference', async () => {
      node = (await comfyPage.getFirstNodeRef())!
    })

    await perfMonitor.measureOperation('pin-node', async () => {
      await node.clickContextMenuOption('Pin')
      await comfyPage.nextFrame()
    })

    await perfMonitor.measureOperation('right-click-pinned-node', async () => {
      await node.click('title', { button: 'right' })
    })

    await expect(
      comfyPage.page.locator('.litemenu-entry:has-text("Unpin")')
    ).toBeAttached()

    const cloneItem = comfyPage.page.locator(
      '.litemenu-entry:has-text("Clone")'
    )

    await perfMonitor.measureOperation('clone-node', async () => {
      await cloneItem.click()
      await expect(cloneItem).toHaveCount(0)
      await comfyPage.nextFrame()
    })

    expect(await comfyPage.getGraphNodesCount()).toBe(nodeCount! + 1)

    await perfMonitor.finishMonitoring(testName)
  })
})
