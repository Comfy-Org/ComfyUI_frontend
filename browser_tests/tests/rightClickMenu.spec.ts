import { expect } from '@playwright/test'

import { NodeBadgeMode } from '@/types/nodeSource'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { DefaultGraphPositions } from '@e2e/fixtures/constants/defaultGraphPositions'
import {
  expectElementScreenshot,
  expectRegionScreenshot,
  graphItems,
  screenshotRegion
} from '@e2e/fixtures/utils/screenshotRegion'

test.use({ initialSettings: { 'Comfy.UseNewMenu': 'Disabled' } })

const EMPTY_LATENT_NODE_ID = 5

function emptyLatentNode(comfyPage: ComfyPage) {
  return comfyPage.nodeOps.getNodeRefById(EMPTY_LATENT_NODE_ID)
}

async function expectCanvasMenuScreenshot(comfyPage: ComfyPage) {
  await expectElementScreenshot(
    comfyPage.contextMenu.litegraphContextMenu,
    'right-click-menu.png'
  )
}

async function expectNodeMenuScreenshot(comfyPage: ComfyPage, name: string) {
  await comfyPage.nextFrame()
  await expectRegionScreenshot(
    comfyPage.page,
    [
      await emptyLatentNode(comfyPage),
      comfyPage.contextMenu.litegraphContextMenu
    ],
    name
  )
}

test.describe(
  'Canvas Right Click Menu',
  { tag: ['@screenshot', '@ui'] },
  () => {
    test('Can add node', async ({ comfyPage }) => {
      await comfyPage.canvasOps.rightClick()
      await expectCanvasMenuScreenshot(comfyPage)
      await comfyPage.page.getByText('Add Node').click()
      await comfyPage.page.getByText('model', { exact: true }).click()
      await comfyPage.page.getByText('loaders').click()
      await comfyPage.page.getByText('Load VAE', { exact: true }).click()
      await comfyPage.contextMenu.waitForHidden()
      await comfyPage.nextFrame()
      await expectRegionScreenshot(
        comfyPage.page,
        [await comfyPage.nodeOps.getNodeRefByType('VAELoader')],
        'add-node-node-added.png'
      )
    })

    test('Can add group', async ({ comfyPage }) => {
      await comfyPage.canvasOps.rightClick()
      await expectCanvasMenuScreenshot(comfyPage)
      await comfyPage.page.getByText('Add Group', { exact: true }).click()
      await comfyPage.contextMenu.waitForHidden()
      await comfyPage.nextFrame()
      await expectRegionScreenshot(
        comfyPage.page,
        [graphItems(comfyPage.page, 'groups')],
        'add-group-group-added.png'
      )
    })
  }
)

test.describe('Node Right Click Menu', { tag: ['@screenshot', '@ui'] }, () => {
  test('Can open properties panel', async ({ comfyPage }) => {
    await comfyPage.canvas.click({
      position: DefaultGraphPositions.emptyLatentWidgetClick,
      button: 'right'
    })
    await comfyPage.page.mouse.move(10, 10)
    await expectNodeMenuScreenshot(comfyPage, 'right-click-node.png')
    await comfyPage.page.getByText('Properties Panel').click()
    await comfyPage.contextMenu.waitForHidden()
    await comfyPage.nextFrame()
    await expectRegionScreenshot(
      comfyPage.page,
      [await emptyLatentNode(comfyPage), comfyPage.page.locator('#node-panel')],
      'right-click-node-properties-panel.png'
    )
  })

  test('Can collapse', async ({ comfyPage }) => {
    await comfyPage.canvas.click({
      position: DefaultGraphPositions.emptyLatentWidgetClick,
      button: 'right'
    })
    await comfyPage.page.mouse.move(10, 10)
    await expectNodeMenuScreenshot(comfyPage, 'right-click-node.png')
    await comfyPage.page.getByText('Collapse').click()
    await comfyPage.contextMenu.waitForHidden()
    await comfyPage.nextFrame()
    await expectRegionScreenshot(
      comfyPage.page,
      [await emptyLatentNode(comfyPage)],
      'right-click-node-collapsed.png'
    )
  })

  test('Can collapse (Node Badge)', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(
      'Comfy.NodeBadge.NodeIdBadgeMode',
      NodeBadgeMode.ShowAll
    )
    await comfyPage.settings.setSetting(
      'Comfy.NodeBadge.NodeSourceBadgeMode',
      NodeBadgeMode.ShowAll
    )

    await comfyPage.canvas.click({
      position: DefaultGraphPositions.emptyLatentWidgetClick,
      button: 'right'
    })
    await comfyPage.page.mouse.move(10, 10)
    await comfyPage.nextFrame()
    await comfyPage.page.getByText('Collapse').click()
    await comfyPage.contextMenu.waitForHidden()
    await comfyPage.nextFrame()
    await expectRegionScreenshot(
      comfyPage.page,
      [await emptyLatentNode(comfyPage)],
      'right-click-node-collapsed-badge.png'
    )
  })

  test('Can bypass', async ({ comfyPage }) => {
    await comfyPage.canvas.click({
      position: DefaultGraphPositions.emptyLatentWidgetClick,
      button: 'right'
    })
    await comfyPage.page.mouse.move(10, 10)
    await expectNodeMenuScreenshot(comfyPage, 'right-click-node.png')
    await comfyPage.page.getByText('Bypass').click()
    await comfyPage.contextMenu.waitForHidden()
    await comfyPage.nextFrame()
    await expectRegionScreenshot(
      comfyPage.page,
      [await emptyLatentNode(comfyPage)],
      'right-click-node-bypassed.png'
    )
  })

  test('Can pin and unpin', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Graph.AutoPanSpeed', 0)
    await comfyPage.canvas.click({
      position: DefaultGraphPositions.emptyLatentWidgetClick,
      button: 'right'
    })
    await comfyPage.page.mouse.move(10, 10)
    await expectNodeMenuScreenshot(comfyPage, 'right-click-node.png')
    await comfyPage.page.locator('.litemenu-entry:has-text("Pin")').click()
    await comfyPage.contextMenu.waitForHidden()
    await comfyPage.nextFrame()

    const latentNode = await emptyLatentNode(comfyPage)
    const pinnedRegion = await screenshotRegion(comfyPage.page, [latentNode])
    const titlePos = await latentNode.getTitlePosition()
    await comfyPage.canvasOps.dragAndDrop(titlePos, { x: 16, y: 16 })
    await pinnedRegion.expectScreenshot('node-pinned.png')
    await comfyPage.canvas.click({
      position: DefaultGraphPositions.emptyLatentWidgetClick,
      button: 'right'
    })
    await comfyPage.page.mouse.move(10, 10)
    await expectNodeMenuScreenshot(comfyPage, 'right-click-pinned-node.png')
    await comfyPage.page.locator('.litemenu-entry:has-text("Unpin")').click()
    await comfyPage.contextMenu.waitForHidden()
    await comfyPage.canvas.click({
      position: DefaultGraphPositions.emptyLatentWidgetClick,
      button: 'right'
    })
    await comfyPage.page.mouse.move(10, 10)
    await expectNodeMenuScreenshot(comfyPage, 'right-click-unpinned-node.png')
  })

  test('Can move after unpin', async ({ comfyPage }) => {
    await comfyPage.canvas.click({
      position: DefaultGraphPositions.emptyLatentWidgetClick,
      button: 'right'
    })
    await comfyPage.page.mouse.move(10, 10)
    await comfyPage.nextFrame()
    await comfyPage.page.locator('.litemenu-entry:has-text("Pin")').click()
    await comfyPage.contextMenu.waitForHidden()
    await comfyPage.canvas.click({
      position: DefaultGraphPositions.emptyLatentWidgetClick,
      button: 'right'
    })
    await comfyPage.page.mouse.move(10, 10)
    await comfyPage.nextFrame()
    await comfyPage.page.locator('.litemenu-entry:has-text("Unpin")').click()
    await comfyPage.contextMenu.waitForHidden()
    await comfyPage.nextFrame()

    const latentNode = await emptyLatentNode(comfyPage)
    const originalPosition = await latentNode.getPosition()
    const titlePos = await latentNode.getTitlePosition()
    await comfyPage.canvasOps.dragAndDrop(titlePos, { x: 200, y: 590 })
    await expect
      .poll(() => latentNode.getPosition())
      .not.toEqual(originalPosition)
  })

  test('Can pin/unpin selected nodes', async ({ comfyPage }) => {
    const pinTargets = [
      ...(await comfyPage.nodeOps.getNodeRefsByTitle(
        'CLIP Text Encode (Prompt)'
      )),
      await emptyLatentNode(comfyPage)
    ]
    await comfyPage.nodeOps.selectNodes(['CLIP Text Encode (Prompt)'])
    await comfyPage.page.keyboard.down('Control')
    await comfyPage.canvas.click({
      position: DefaultGraphPositions.emptyLatentWidgetClick,
      button: 'right'
    })
    await comfyPage.page.mouse.move(10, 10)
    await comfyPage.nextFrame()
    await comfyPage.page.locator('.litemenu-entry:has-text("Pin")').click()
    await comfyPage.page.keyboard.up('Control')
    await comfyPage.contextMenu.waitForHidden()
    await comfyPage.nextFrame()
    await expectRegionScreenshot(
      comfyPage.page,
      [...pinTargets, graphItems(comfyPage.page, 'selection')],
      'selected-nodes-pinned.png'
    )
    await comfyPage.canvas.click({
      position: DefaultGraphPositions.emptyLatentWidgetClick,
      button: 'right'
    })
    await comfyPage.page.mouse.move(10, 10)
    await comfyPage.nextFrame()
    await comfyPage.page.locator('.litemenu-entry:has-text("Unpin")').click()
    await comfyPage.contextMenu.waitForHidden()
    await comfyPage.nextFrame()
    await expectRegionScreenshot(
      comfyPage.page,
      pinTargets,
      'selected-nodes-unpinned.png'
    )
  })

  test('Can clone pinned nodes', async ({ comfyPage }) => {
    const nodeCount = await comfyPage.nodeOps.getGraphNodesCount()
    const node = (await comfyPage.nodeOps.getFirstNodeRef())!
    await node.clickContextMenuOption('Pin')
    await comfyPage.contextMenu.waitForHidden()
    await node.click('title', { button: 'right' })
    await expect(
      comfyPage.page.locator('.litemenu-entry:has-text("Unpin")')
    ).toBeAttached()
    const cloneItem = comfyPage.page.locator(
      '.litemenu-entry:has-text("Clone")'
    )
    await cloneItem.click()
    await comfyPage.contextMenu.waitForHidden()
    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBe(nodeCount + 1)
  })
})
