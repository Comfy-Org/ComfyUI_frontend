import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { DefaultGraphPositions } from '@e2e/fixtures/constants/defaultGraphPositions'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
  // Wait for the legacy menu to appear and canvas to settle after layout shift.
  await comfyPage.page.locator('.comfy-menu').waitFor({ state: 'visible' })
  await comfyPage.nextFrame()
})

test.describe('Slot Interaction', () => {
  test('Middle-click on output slot should create default node when setting enabled', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
    await comfyPage.settings.setSetting(
      'Comfy.Node.MiddleClickRerouteNode',
      true
    )
    await comfyPage.nextFrame()

    try {
      const [nodeRef] =
        await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
      expect(
        nodeRef,
        'Expected CLIPTextEncode node in default workflow'
      ).toBeTruthy()

      const nodeId = nodeRef.id
      const slotPos = await comfyPage.page.evaluate((targetNodeId) => {
        const node = window.app!.graph!.getNodeById(targetNodeId)
        if (!node) return null
        const pos = node.getOutputPos(0)
        const canvas = window.app!.canvas!
        const converted = canvas.convertCanvasToOffset(pos)
        return { x: converted[0], y: converted[1] }
      }, nodeId)
      if (!slotPos) throw new Error('Expected to resolve output slot position')

      const initialNodeCount = await comfyPage.nodeOps.getGraphNodesCount()

      await comfyPage.page.mouse.move(slotPos.x, slotPos.y)
      await comfyPage.page.mouse.down({ button: 'middle' })
      await comfyPage.page.mouse.up({ button: 'middle' })
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBeGreaterThan(initialNodeCount)

      await expect
        .poll(async () => {
          return comfyPage.page.evaluate((srcNodeId) => {
            const node = window.app!.graph!.getNodeById(srcNodeId)
            if (!node) return false
            const output = node.outputs?.[0]
            return (output?.links?.length ?? 0) > 0
          }, nodeId)
        })
        .toBe(true)
    } finally {
      await comfyPage.settings.setSetting(
        'Comfy.Node.MiddleClickRerouteNode',
        false
      )
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    }
  })

  test.describe('Edge Interaction', { tag: '@screenshot' }, () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.LinkRelease.Action',
        'no action'
      )
      await comfyPage.settings.setSetting(
        'Comfy.LinkRelease.ActionShift',
        'no action'
      )
    })

    // Test both directions of edge connection.
    ;[{ reverse: false }, { reverse: true }].forEach(({ reverse }) => {
      test(`Can disconnect/connect edge ${reverse ? 'reverse' : 'normal'}`, async ({
        comfyPage
      }) => {
        await comfyPage.canvasOps.disconnectEdge()
        await expect(comfyPage.canvas).toHaveScreenshot('disconnected-edge.png')
        await comfyPage.canvasOps.connectEdge({ reverse })
        // Move mouse to empty area to avoid slot highlight.
        await comfyPage.canvasOps.moveMouseToEmptyArea()
        // Litegraph renders edge with a slight offset.
        await expect(comfyPage.canvas).toHaveScreenshot('default.png', {
          maxDiffPixels: 50
        })
      })
    })

    test('Can move link', async ({ comfyPage }) => {
      await comfyPage.canvasOps.dragAndDrop(
        DefaultGraphPositions.clipTextEncodeNode1InputSlot,
        DefaultGraphPositions.emptySpace
      )
      await expect(comfyPage.canvas).toHaveScreenshot('disconnected-edge.png')
      await comfyPage.canvasOps.dragAndDrop(
        DefaultGraphPositions.clipTextEncodeNode2InputSlot,
        DefaultGraphPositions.clipTextEncodeNode1InputSlot
      )
      await expect(comfyPage.canvas).toHaveScreenshot('moved-link.png')
    })

    test('Can copy link by shift-drag existing link', async ({ comfyPage }) => {
      await comfyPage.canvasOps.dragAndDrop(
        DefaultGraphPositions.clipTextEncodeNode1InputSlot,
        DefaultGraphPositions.emptySpace
      )
      await expect(comfyPage.canvas).toHaveScreenshot('disconnected-edge.png')
      await comfyPage.page.keyboard.down('Shift')
      await comfyPage.canvasOps.dragAndDrop(
        DefaultGraphPositions.clipTextEncodeNode2InputLinkPath,
        DefaultGraphPositions.clipTextEncodeNode1InputSlot
      )
      await comfyPage.page.keyboard.up('Shift')
      await expect(comfyPage.canvas).toHaveScreenshot('copied-link.png')
    })

    test('Auto snap&highlight when dragging link over node', async ({
      comfyPage,
      comfyMouse
    }) => {
      await comfyPage.settings.setSetting('Comfy.Node.AutoSnapLinkToSlot', true)
      await comfyPage.settings.setSetting('Comfy.Node.SnapHighlightsNode', true)

      await comfyMouse.move(DefaultGraphPositions.clipTextEncodeNode1InputSlot)
      await comfyMouse.drag(DefaultGraphPositions.clipTextEncodeNode2InputSlot)
      await expect(comfyPage.canvas).toHaveScreenshot('snapped-highlighted.png')
    })
  })
})
