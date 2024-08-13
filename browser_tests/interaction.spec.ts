import { expect } from '@playwright/test'
import { ComfyPage, comfyPageFixture as test } from './ComfyPage'

test.describe('Node Interaction', () => {
  test('Can enter prompt', async ({ comfyPage }) => {
    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    await textBox.fill('Hello World')
    await expect(textBox).toHaveValue('Hello World')
    await textBox.fill('Hello World 2')
    await expect(textBox).toHaveValue('Hello World 2')
  })

  test('Can highlight selected', async ({ comfyPage }) => {
    await expect(comfyPage.canvas).toHaveScreenshot('default.png')
    await comfyPage.clickTextEncodeNode1()
    await expect(comfyPage.canvas).toHaveScreenshot('selected-node1.png')
    await comfyPage.clickTextEncodeNode2()
    await expect(comfyPage.canvas).toHaveScreenshot('selected-node2.png')
  })

  // Flaky. See https://github.com/comfyanonymous/ComfyUI/issues/3866
  test.skip('Can drag node', async ({ comfyPage }) => {
    await comfyPage.dragNode2()
    await expect(comfyPage.canvas).toHaveScreenshot('dragged-node1.png')
  })

  test('Can disconnect/connect edge', async ({ comfyPage }) => {
    await comfyPage.disconnectEdge()
    // Close search menu popped up.
    await comfyPage.page.keyboard.press('Escape')
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'disconnected-edge-with-menu.png'
    )
    await comfyPage.connectEdge()
    // Litegraph renders edge with a slight offset.
    await expect(comfyPage.canvas).toHaveScreenshot('default.png', {
      maxDiffPixels: 50
    })
  })

  test('Can adjust widget value', async ({ comfyPage }) => {
    await comfyPage.adjustWidgetValue()
    await expect(comfyPage.canvas).toHaveScreenshot('adjusted-widget-value.png')
  })

  test('Link snap to slot', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('snap_to_slot')
    await expect(comfyPage.canvas).toHaveScreenshot('snap_to_slot.png')

    const outputSlotPos = {
      x: 406,
      y: 333
    }
    const samplerNodeCenterPos = {
      x: 748,
      y: 77
    }
    await comfyPage.dragAndDrop(outputSlotPos, samplerNodeCenterPos)

    await expect(comfyPage.canvas).toHaveScreenshot('snap_to_slot_linked.png')
  })

  test('Can batch move links by drag with shift', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('batch_move_links')
    await expect(comfyPage.canvas).toHaveScreenshot('batch_move_links.png')

    const outputSlot1Pos = {
      x: 304,
      y: 127
    }
    const outputSlot2Pos = {
      x: 307,
      y: 310
    }

    await comfyPage.page.keyboard.down('Shift')
    await comfyPage.dragAndDrop(outputSlot1Pos, outputSlot2Pos)
    await comfyPage.page.keyboard.up('Shift')

    await expect(comfyPage.canvas).toHaveScreenshot(
      'batch_move_links_moved.png'
    )
  })

  test('Can batch disconnect links with ctrl+alt+click', async ({
    comfyPage
  }) => {
    const loadCheckpointClipSlotPos = {
      x: 332,
      y: 508
    }
    await comfyPage.canvas.click({
      modifiers: ['Control', 'Alt'],
      position: loadCheckpointClipSlotPos
    })
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'batch-disconnect-links-disconnected.png'
    )
  })
})

test.describe('Canvas Interaction', () => {
  test('Can zoom in/out', async ({ comfyPage }) => {
    await comfyPage.zoom(-100)
    await expect(comfyPage.canvas).toHaveScreenshot('zoomed-in.png')
    await comfyPage.zoom(200)
    await expect(comfyPage.canvas).toHaveScreenshot('zoomed-out.png')
  })

  test('Can pan', async ({ comfyPage }) => {
    await comfyPage.pan({ x: 200, y: 200 })
    await expect(comfyPage.canvas).toHaveScreenshot('panned.png')
  })
})
