import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './fixtures/ComfyPage'

test.describe('Item Interaction', () => {
  test('Can select/delete all items', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('mixed_graph_items')
    await comfyPage.canvas.press('Control+a')
    await expect(comfyPage.canvas).toHaveScreenshot('selected-all.png')
    await comfyPage.canvas.press('Delete')
    await expect(comfyPage.canvas).toHaveScreenshot('deleted-all.png')
  })

  test('Can pin/unpin items with keyboard shortcut', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('mixed_graph_items')
    await comfyPage.canvas.press('Control+a')
    await comfyPage.canvas.press('KeyP')
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot('pinned-all.png')
    await comfyPage.canvas.press('KeyP')
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot('unpinned-all.png')
  })
})

test.describe('Node Interaction', () => {
  test('Can enter prompt', async ({ comfyPage }) => {
    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    await textBox.fill('Hello World')
    await expect(textBox).toHaveValue('Hello World')
    await textBox.fill('Hello World 2')
    await expect(textBox).toHaveValue('Hello World 2')
  })

  test.describe('Node Selection', () => {
    const multiSelectModifiers = ['Control', 'Shift', 'Meta'] as const

    multiSelectModifiers.forEach((modifier) => {
      test(`Can add multiple nodes to selection using ${modifier}+Click`, async ({
        comfyPage
      }) => {
        const clipNodes = await comfyPage.getNodeRefsByType('CLIPTextEncode')
        for (const node of clipNodes) {
          await node.click('title', { modifiers: [modifier] })
        }
        const selectedNodeCount = await comfyPage.getSelectedGraphNodesCount()
        expect(selectedNodeCount).toBe(clipNodes.length)
      })
    })

    test('Can highlight selected', async ({ comfyPage }) => {
      await expect(comfyPage.canvas).toHaveScreenshot('default.png')
      await comfyPage.clickTextEncodeNode1()
      await expect(comfyPage.canvas).toHaveScreenshot('selected-node1.png')
      await comfyPage.clickTextEncodeNode2()
      await expect(comfyPage.canvas).toHaveScreenshot('selected-node2.png')
    })

    test('Can drag-select nodes with Meta (mac)', async ({ comfyPage }) => {
      const clipNodes = await comfyPage.getNodeRefsByType('CLIPTextEncode')
      const clipNode1Pos = await clipNodes[0].getPosition()
      const clipNode2Pos = await clipNodes[1].getPosition()
      const offset = 64
      await comfyPage.page.keyboard.down('Meta')
      await comfyPage.dragAndDrop(
        {
          x: Math.min(clipNode1Pos.x, clipNode2Pos.x) - offset,
          y: Math.min(clipNode1Pos.y, clipNode2Pos.y) - offset
        },
        {
          x: Math.max(clipNode1Pos.x, clipNode2Pos.x) + offset,
          y: Math.max(clipNode1Pos.y, clipNode2Pos.y) + offset
        }
      )
      await comfyPage.page.keyboard.up('Meta')
      expect(await comfyPage.getSelectedGraphNodesCount()).toBe(
        clipNodes.length
      )
    })
  })

  test('Can drag node', async ({ comfyPage }) => {
    await comfyPage.dragNode2()
    await expect(comfyPage.canvas).toHaveScreenshot('dragged-node1.png')
  })

  test.describe('Edge Interaction', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.LinkRelease.Action', 'no action')
      await comfyPage.setSetting('Comfy.LinkRelease.ActionShift', 'no action')
    })

    test('Can disconnect/connect edge', async ({ comfyPage }) => {
      await comfyPage.disconnectEdge()
      await expect(comfyPage.canvas).toHaveScreenshot('disconnected-edge.png')
      await comfyPage.connectEdge()
      // Move mouse to empty area to avoid slot highlight.
      await comfyPage.moveMouseToEmptyArea()
      // Litegraph renders edge with a slight offset.
      await expect(comfyPage.canvas).toHaveScreenshot('default.png', {
        maxDiffPixels: 50
      })
    })

    // Chromium 2x cannot move link.
    // See https://github.com/Comfy-Org/ComfyUI_frontend/actions/runs/10876381315/job/30176211513
    test.skip('Can move link', async ({ comfyPage }) => {
      await comfyPage.dragAndDrop(
        comfyPage.clipTextEncodeNode1InputSlot,
        comfyPage.emptySpace
      )
      await expect(comfyPage.canvas).toHaveScreenshot('disconnected-edge.png')
      await comfyPage.dragAndDrop(
        comfyPage.clipTextEncodeNode2InputSlot,
        comfyPage.clipTextEncodeNode1InputSlot
      )
      await expect(comfyPage.canvas).toHaveScreenshot('moved-link.png')
    })

    // Copy link is not working on CI at all
    // Chromium 2x recognize it as dragging canvas.
    // Chromium triggers search box after link release. The link is indeed copied.
    // See https://github.com/Comfy-Org/ComfyUI_frontend/actions/runs/10876381315/job/30176211513
    test.skip('Can copy link by shift-drag existing link', async ({
      comfyPage
    }) => {
      await comfyPage.dragAndDrop(
        comfyPage.clipTextEncodeNode1InputSlot,
        comfyPage.emptySpace
      )
      await expect(comfyPage.canvas).toHaveScreenshot('disconnected-edge.png')
      await comfyPage.page.keyboard.down('Shift')
      await comfyPage.dragAndDrop(
        comfyPage.clipTextEncodeNode2InputLinkPath,
        comfyPage.clipTextEncodeNode1InputSlot
      )
      await comfyPage.page.keyboard.up('Shift')
      await expect(comfyPage.canvas).toHaveScreenshot('copied-link.png')
    })

    test('Auto snap&highlight when dragging link over node', async ({
      comfyPage
    }) => {
      await comfyPage.setSetting('Comfy.Node.AutoSnapLinkToSlot', true)
      await comfyPage.setSetting('Comfy.Node.SnapHighlightsNode', true)

      await comfyPage.page.mouse.move(
        comfyPage.clipTextEncodeNode1InputSlot.x,
        comfyPage.clipTextEncodeNode1InputSlot.y
      )
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(
        comfyPage.clipTextEncodeNode2InputSlot.x,
        comfyPage.clipTextEncodeNode2InputSlot.y
      )
      await expect(comfyPage.canvas).toHaveScreenshot('snapped-highlighted.png')
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

  test('Can toggle dom widget node open/closed', async ({ comfyPage }) => {
    await expect(comfyPage.canvas).toHaveScreenshot('default.png')
    await comfyPage.clickTextEncodeNodeToggler()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'text-encode-toggled-off.png'
    )
    await comfyPage.delay(1000)
    await comfyPage.clickTextEncodeNodeToggler()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'text-encode-toggled-back-open.png'
    )
  })

  test('Can close prompt dialog with canvas click (number widget)', async ({
    comfyPage
  }) => {
    const numberWidgetPos = {
      x: 724,
      y: 645
    }
    await comfyPage.canvas.click({
      position: numberWidgetPos
    })
    await expect(comfyPage.canvas).toHaveScreenshot('prompt-dialog-opened.png')
    // Wait for 1s so that it does not trigger the search box by double click.
    await comfyPage.page.waitForTimeout(1000)
    await comfyPage.canvas.click({
      position: {
        x: 10,
        y: 10
      }
    })
    await expect(comfyPage.canvas).toHaveScreenshot('prompt-dialog-closed.png')
  })

  test('Can close prompt dialog with canvas click (text widget)', async ({
    comfyPage
  }) => {
    const textWidgetPos = {
      x: 167,
      y: 143
    }
    await comfyPage.loadWorkflow('single_save_image_node')
    await comfyPage.canvas.click({
      position: textWidgetPos
    })
    await expect(comfyPage.canvas).toHaveScreenshot(
      'prompt-dialog-opened-text.png'
    )
    await comfyPage.page.waitForTimeout(1000)
    await comfyPage.canvas.click({
      position: {
        x: 10,
        y: 10
      }
    })
    await expect(comfyPage.canvas).toHaveScreenshot(
      'prompt-dialog-closed-text.png'
    )
  })

  test('Can double click node title to edit', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('single_ksampler')
    await comfyPage.canvas.dblclick({
      position: {
        x: 50,
        y: 10
      }
    })
    await comfyPage.page.keyboard.type('Hello World')
    await comfyPage.page.keyboard.press('Enter')
    await expect(comfyPage.canvas).toHaveScreenshot('node-title-edited.png')
  })

  test('Double click node body does not trigger edit', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('single_ksampler')
    await comfyPage.canvas.dblclick({
      position: {
        x: 50,
        y: 50
      }
    })
    expect(await comfyPage.page.locator('.node-title-editor').count()).toBe(0)
  })

  test('Can group selected nodes', async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.GroupSelectedNodes.Padding', 10)
    await comfyPage.select2Nodes()
    await comfyPage.page.keyboard.down('Control')
    await comfyPage.page.keyboard.press('KeyG')
    await comfyPage.page.keyboard.up('Control')
    await comfyPage.nextFrame()
    // Confirm group title
    await comfyPage.page.keyboard.press('Enter')
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot('group-selected-nodes.png')
  })

  // Somehow this test fails on GitHub Actions. It works locally.
  // https://github.com/Comfy-Org/ComfyUI_frontend/pull/736
  test.skip('Can pin/unpin nodes with keyboard shortcut', async ({
    comfyPage
  }) => {
    await comfyPage.select2Nodes()
    await comfyPage.canvas.press('KeyP')
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot('nodes-pinned.png')
    await comfyPage.canvas.press('KeyP')
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot('nodes-unpinned.png')
  })

  test('Can bypass/unbypass nodes with keyboard shortcut', async ({
    comfyPage
  }) => {
    await comfyPage.select2Nodes()
    await comfyPage.canvas.press('Control+b')
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot('nodes-bypassed.png')
    await comfyPage.canvas.press('Control+b')
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot('nodes-unbypassed.png')
  })
})

test.describe('Group Interaction', () => {
  test('Can double click group title to edit', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('single_group')
    await comfyPage.canvas.dblclick({
      position: {
        x: 50,
        y: 10
      }
    })
    await comfyPage.page.keyboard.type('Hello World')
    await comfyPage.page.keyboard.press('Enter')
    await expect(comfyPage.canvas).toHaveScreenshot('group-title-edited.png')
  })
})

test.describe('Canvas Interaction', () => {
  test('Can zoom in/out', async ({ comfyPage }) => {
    await comfyPage.zoom(-100)
    await expect(comfyPage.canvas).toHaveScreenshot('zoomed-in.png')
    await comfyPage.zoom(200)
    await expect(comfyPage.canvas).toHaveScreenshot('zoomed-out.png')
  })

  test('Can zoom very far out', async ({ comfyPage }) => {
    await comfyPage.zoom(100, 12)
    await expect(comfyPage.canvas).toHaveScreenshot('zoomed-very-far-out.png')
    await comfyPage.zoom(-100, 12)
    await expect(comfyPage.canvas).toHaveScreenshot('zoomed-back-in.png')
  })

  test('Can zoom in/out with ctrl+shift+vertical-drag', async ({
    comfyPage
  }) => {
    await comfyPage.page.keyboard.down('Control')
    await comfyPage.page.keyboard.down('Shift')
    await comfyPage.dragAndDrop({ x: 10, y: 100 }, { x: 10, y: 40 })
    await expect(comfyPage.canvas).toHaveScreenshot('zoomed-in-ctrl-shift.png')
    await comfyPage.dragAndDrop({ x: 10, y: 40 }, { x: 10, y: 160 })
    await expect(comfyPage.canvas).toHaveScreenshot('zoomed-out-ctrl-shift.png')
    await comfyPage.dragAndDrop({ x: 10, y: 280 }, { x: 10, y: 220 })
    await expect(comfyPage.canvas).toHaveScreenshot(
      'zoomed-default-ctrl-shift.png'
    )
    await comfyPage.page.keyboard.up('Control')
    await comfyPage.page.keyboard.up('Shift')
  })

  test('Can zoom in/out after decreasing canvas zoom speed setting', async ({
    comfyPage
  }) => {
    await comfyPage.setSetting('Comfy.Graph.ZoomSpeed', 1.05)
    await comfyPage.zoom(-100, 4)
    await expect(comfyPage.canvas).toHaveScreenshot(
      'zoomed-in-low-zoom-speed.png'
    )
    await comfyPage.zoom(100, 8)
    await expect(comfyPage.canvas).toHaveScreenshot(
      'zoomed-out-low-zoom-speed.png'
    )
    await comfyPage.setSetting('Comfy.Graph.ZoomSpeed', 1.1)
  })

  test('Can zoom in/out after increasing canvas zoom speed', async ({
    comfyPage
  }) => {
    await comfyPage.setSetting('Comfy.Graph.ZoomSpeed', 1.5)
    await comfyPage.zoom(-100, 4)
    await expect(comfyPage.canvas).toHaveScreenshot(
      'zoomed-in-high-zoom-speed.png'
    )
    await comfyPage.zoom(100, 8)
    await expect(comfyPage.canvas).toHaveScreenshot(
      'zoomed-out-high-zoom-speed.png'
    )
    await comfyPage.setSetting('Comfy.Graph.ZoomSpeed', 1.1)
  })

  test('Can pan', async ({ comfyPage }) => {
    await comfyPage.pan({ x: 200, y: 200 })
    await expect(comfyPage.canvas).toHaveScreenshot('panned.png')
  })

  test('Cursor style changes when panning', async ({ comfyPage }) => {
    const getCursorStyle = async () => {
      return await comfyPage.page.evaluate(() => {
        return (
          document.getElementById('graph-canvas')!.style.cursor || 'default'
        )
      })
    }

    await comfyPage.page.mouse.move(10, 10)
    expect(await getCursorStyle()).toBe('default')
    await comfyPage.page.mouse.down()
    expect(await getCursorStyle()).toBe('grabbing')
    await comfyPage.page.mouse.up()
    expect(await getCursorStyle()).toBe('default')

    await comfyPage.page.keyboard.down('Space')
    expect(await getCursorStyle()).toBe('grab')
    await comfyPage.page.mouse.down()
    expect(await getCursorStyle()).toBe('grabbing')
    await comfyPage.page.mouse.up()
    expect(await getCursorStyle()).toBe('grab')
    await comfyPage.page.keyboard.up('Space')
    expect(await getCursorStyle()).toBe('default')
  })

  test('Can pan when dragging a link', async ({ comfyPage }) => {
    const posSlot1 = comfyPage.clipTextEncodeNode1InputSlot
    await comfyPage.page.mouse.move(posSlot1.x, posSlot1.y)
    await comfyPage.page.mouse.down()
    const posEmpty = comfyPage.emptySpace
    await comfyPage.page.mouse.move(posEmpty.x, posEmpty.y)
    await expect(comfyPage.canvas).toHaveScreenshot('dragging-link1.png')
    await comfyPage.page.keyboard.down('Space')
    await comfyPage.page.mouse.move(posEmpty.x + 100, posEmpty.y + 100)
    // Canvas should be panned.
    await expect(comfyPage.canvas).toHaveScreenshot(
      'panning-when-dragging-link.png'
    )
    await comfyPage.page.keyboard.up('Space')
    await comfyPage.page.mouse.move(posEmpty.x, posEmpty.y)
    // Should be back to dragging link mode when space is released.
    await expect(comfyPage.canvas).toHaveScreenshot('dragging-link2.png')
    await comfyPage.page.mouse.up()
  })

  test('Can pan very far and back', async ({ comfyPage }) => {
    // intentionally slice the edge of where the clip text encode dom widgets are
    await comfyPage.pan({ x: -800, y: -300 }, { x: 1000, y: 10 })
    await expect(comfyPage.canvas).toHaveScreenshot('panned-step-one.png')
    await comfyPage.pan({ x: -200, y: 0 }, { x: 1000, y: 10 })
    await expect(comfyPage.canvas).toHaveScreenshot('panned-step-two.png')
    await comfyPage.pan({ x: -2200, y: -2200 }, { x: 1000, y: 10 })
    await expect(comfyPage.canvas).toHaveScreenshot('panned-far-away.png')
    await comfyPage.pan({ x: 2200, y: 2200 }, { x: 1000, y: 10 })
    await expect(comfyPage.canvas).toHaveScreenshot('panned-back-from-far.png')
    await comfyPage.pan({ x: 200, y: 0 }, { x: 1000, y: 10 })
    await expect(comfyPage.canvas).toHaveScreenshot('panned-back-to-two.png')
    await comfyPage.pan({ x: 800, y: 300 }, { x: 1000, y: 10 })
    await expect(comfyPage.canvas).toHaveScreenshot('panned-back-to-one.png')
  })

  test('@mobile Can pan with touch', async ({ comfyPage }) => {
    await comfyPage.closeMenu()
    await comfyPage.panWithTouch({ x: 200, y: 200 })
    await expect(comfyPage.canvas).toHaveScreenshot('panned-touch.png')
  })
})

test.describe('Widget Interaction', () => {
  test('Undo text input', async ({ comfyPage }) => {
    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    await textBox.fill('')
    await expect(textBox).toHaveValue('')
    await textBox.fill('Hello World')
    await expect(textBox).toHaveValue('Hello World')
    await comfyPage.ctrlZ()
    await expect(textBox).toHaveValue('')
  })

  test('Undo attention edit', async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.EditAttention.Delta', 0.05)
    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    await textBox.fill('1girl')
    await expect(textBox).toHaveValue('1girl')
    await textBox.selectText()
    await comfyPage.ctrlArrowUp()
    await expect(textBox).toHaveValue('(1girl:1.05)')
    await comfyPage.ctrlZ()
    await expect(textBox).toHaveValue('1girl')
  })
})

test.describe('Load workflow', () => {
  test('Can load workflow with string node id', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('string_node_id')
    await expect(comfyPage.canvas).toHaveScreenshot('string_node_id.png')
  })

  test('Can load workflow with ("STRING",) input node', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('string_input')
    await expect(comfyPage.canvas).toHaveScreenshot('string_input.png')
  })
})

test.describe('Load duplicate workflow', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test('A workflow can be loaded multiple times in a row', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('single_ksampler')
    await comfyPage.menu.workflowsTab.open()
    await comfyPage.menu.workflowsTab.newBlankWorkflowButton.click()
    await comfyPage.loadWorkflow('single_ksampler')
    expect(await comfyPage.getGraphNodesCount()).toBe(1)
  })
})
