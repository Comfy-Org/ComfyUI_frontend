import { expect } from '@playwright/test'
import { Position } from '@vueuse/core'

import {
  type ComfyPage,
  comfyPageFixture as test,
  testComfySnapToGridGridSize
} from '../fixtures/ComfyPage'
import { type NodeReference } from '../fixtures/utils/litegraphUtils'

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

    test('@2x Can highlight selected', async ({ comfyPage }) => {
      await expect(comfyPage.canvas).toHaveScreenshot('default.png')
      await comfyPage.clickTextEncodeNode1()
      await expect(comfyPage.canvas).toHaveScreenshot('selected-node1.png')
      await comfyPage.clickTextEncodeNode2()
      await expect(comfyPage.canvas).toHaveScreenshot('selected-node2.png')
    })

    const dragSelectNodes = async (
      comfyPage: ComfyPage,
      clipNodes: NodeReference[]
    ) => {
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
    }

    test('Can drag-select nodes with Meta (mac)', async ({ comfyPage }) => {
      const clipNodes = await comfyPage.getNodeRefsByType('CLIPTextEncode')
      await dragSelectNodes(comfyPage, clipNodes)
      expect(await comfyPage.getSelectedGraphNodesCount()).toBe(
        clipNodes.length
      )
    })

    test('Can move selected nodes using the Comfy.Canvas.MoveSelectedNodes.{Up|Down|Left|Right} commands', async ({
      comfyPage
    }) => {
      const clipNodes = await comfyPage.getNodeRefsByType('CLIPTextEncode')
      const getPositions = () =>
        Promise.all(clipNodes.map((node) => node.getPosition()))
      const testDirection = async ({
        direction,
        expectedPosition
      }: {
        direction: string
        expectedPosition: (originalPosition: Position) => Position
      }) => {
        const originalPositions = await getPositions()
        await dragSelectNodes(comfyPage, clipNodes)
        await comfyPage.executeCommand(
          `Comfy.Canvas.MoveSelectedNodes.${direction}`
        )
        await comfyPage.canvas.press(`Control+Arrow${direction}`)
        const newPositions = await getPositions()
        expect(newPositions).toEqual(originalPositions.map(expectedPosition))
      }
      await testDirection({
        direction: 'Down',
        expectedPosition: (originalPosition) => ({
          ...originalPosition,
          y: originalPosition.y + testComfySnapToGridGridSize
        })
      })
      await testDirection({
        direction: 'Right',
        expectedPosition: (originalPosition) => ({
          ...originalPosition,
          x: originalPosition.x + testComfySnapToGridGridSize
        })
      })
      await testDirection({
        direction: 'Up',
        expectedPosition: (originalPosition) => ({
          ...originalPosition,
          y: originalPosition.y - testComfySnapToGridGridSize
        })
      })
      await testDirection({
        direction: 'Left',
        expectedPosition: (originalPosition) => ({
          ...originalPosition,
          x: originalPosition.x - testComfySnapToGridGridSize
        })
      })
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

    // Test both directions of edge connection.
    ;[{ reverse: false }, { reverse: true }].forEach(({ reverse }) => {
      test(`Can disconnect/connect edge ${reverse ? 'reverse' : 'normal'}`, async ({
        comfyPage
      }) => {
        await comfyPage.disconnectEdge()
        await expect(comfyPage.canvas).toHaveScreenshot('disconnected-edge.png')
        await comfyPage.connectEdge({ reverse })
        // Move mouse to empty area to avoid slot highlight.
        await comfyPage.moveMouseToEmptyArea()
        // Litegraph renders edge with a slight offset.
        await expect(comfyPage.canvas).toHaveScreenshot('default.png', {
          maxDiffPixels: 50
        })
      })
    })

    test('Can move link', async ({ comfyPage }) => {
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

    // Shift drag copy link regressed. See https://github.com/Comfy-Org/ComfyUI_frontend/issues/2941
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
      comfyPage,
      comfyMouse
    }) => {
      await comfyPage.setSetting('Comfy.Node.AutoSnapLinkToSlot', true)
      await comfyPage.setSetting('Comfy.Node.SnapHighlightsNode', true)

      await comfyMouse.move(comfyPage.clipTextEncodeNode1InputSlot)
      await comfyMouse.drag(comfyPage.clipTextEncodeNode2InputSlot)
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
      },
      delay: 5
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
      },
      delay: 5
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

  test('Can fit group to contents', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('oversized_group')
    await comfyPage.ctrlA()
    await comfyPage.nextFrame()
    await comfyPage.executeCommand('Comfy.Graph.FitGroupToContents')
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot('group-fit-to-contents.png')
  })

  test('Can pin/unpin nodes', async ({ comfyPage }) => {
    await comfyPage.select2Nodes()
    await comfyPage.executeCommand('Comfy.Canvas.ToggleSelectedNodes.Pin')
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot('nodes-pinned.png')
    await comfyPage.executeCommand('Comfy.Canvas.ToggleSelectedNodes.Pin')
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
      },
      delay: 5
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
    // Move mouse should not alter cursor style.
    await comfyPage.page.mouse.move(10, 20)
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

  // https://github.com/Comfy-Org/litegraph.js/pull/424
  test('Properly resets dragging state after pan mode sequence', async ({
    comfyPage
  }) => {
    const getCursorStyle = async () => {
      return await comfyPage.page.evaluate(() => {
        return (
          document.getElementById('graph-canvas')!.style.cursor || 'default'
        )
      })
    }

    // Initial state check
    await comfyPage.page.mouse.move(10, 10)
    expect(await getCursorStyle()).toBe('default')

    // Click and hold
    await comfyPage.page.mouse.down()
    expect(await getCursorStyle()).toBe('grabbing')

    // Press space while holding click
    await comfyPage.page.keyboard.down('Space')
    expect(await getCursorStyle()).toBe('grabbing')

    // Release click while space is still down
    await comfyPage.page.mouse.up()
    expect(await getCursorStyle()).toBe('grab')

    // Release space
    await comfyPage.page.keyboard.up('Space')
    expect(await getCursorStyle()).toBe('default')

    // Move mouse - cursor should remain default
    await comfyPage.page.mouse.move(20, 20)
    expect(await getCursorStyle()).toBe('default')
  })

  test('Can pan when dragging a link', async ({ comfyPage, comfyMouse }) => {
    const posSlot1 = comfyPage.clipTextEncodeNode1InputSlot
    await comfyMouse.move(posSlot1)
    const posEmpty = comfyPage.emptySpace
    await comfyMouse.drag(posEmpty)
    await expect(comfyPage.canvas).toHaveScreenshot('dragging-link1.png')

    await comfyPage.page.keyboard.down('Space')
    await comfyMouse.mouse.move(posEmpty.x + 100, posEmpty.y + 100)
    // Canvas should be panned.
    await expect(comfyPage.canvas).toHaveScreenshot(
      'panning-when-dragging-link.png'
    )
    await comfyPage.page.keyboard.up('Space')
    await comfyMouse.move(posEmpty)
    // Should be back to dragging link mode when space is released.
    await expect(comfyPage.canvas).toHaveScreenshot('dragging-link2.png')
    await comfyMouse.drop()
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
    await comfyPage.ctrlZ(null)
    await expect(textBox).toHaveValue('')
  })

  test('Undo attention edit', async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.EditAttention.Delta', 0.05)
    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    await textBox.fill('1girl')
    await expect(textBox).toHaveValue('1girl')
    await textBox.selectText()
    await comfyPage.ctrlArrowUp(null)
    await expect(textBox).toHaveValue('(1girl:1.05)')
    await comfyPage.ctrlZ(null)
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

  test('Restore workflow on reload (switch workflow)', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('single_ksampler')
    await expect(comfyPage.canvas).toHaveScreenshot('single_ksampler.png')
    await comfyPage.setup({ clearStorage: false })
    await expect(comfyPage.canvas).toHaveScreenshot('single_ksampler.png')
  })

  test('Restore workflow on reload (modify workflow)', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('single_ksampler')
    const node = (await comfyPage.getFirstNodeRef())!
    await node.click('collapse')
    // Wait 300ms between 2 clicks so that it is not treated as a double click
    // by litegraph.
    await comfyPage.page.waitForTimeout(300)
    await comfyPage.clickEmptySpace()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'single_ksampler_modified.png'
    )
    await comfyPage.setup({ clearStorage: false })
    await expect(comfyPage.canvas).toHaveScreenshot(
      'single_ksampler_modified.png'
    )
  })

  test.describe('Restore all open workflows on reload', () => {
    let workflowA: string
    let workflowB: string

    const generateUniqueFilename = (extension = '') =>
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${extension}`

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')

      workflowA = generateUniqueFilename()
      await comfyPage.menu.topbar.saveWorkflow(workflowA)
      workflowB = generateUniqueFilename()
      await comfyPage.menu.topbar.triggerTopbarCommand(['Workflow', 'New'])
      await comfyPage.menu.topbar.saveWorkflow(workflowB)

      // Wait for localStorage to persist the workflow paths before reloading
      await comfyPage.page.waitForFunction(
        () => !!window.localStorage.getItem('Comfy.OpenWorkflowsPaths')
      )
      await comfyPage.setup({ clearStorage: false })
    })

    test('Restores topbar workflow tabs after reload', async ({
      comfyPage
    }) => {
      await comfyPage.setSetting(
        'Comfy.Workflow.WorkflowTabsPosition',
        'Topbar'
      )
      const tabs = await comfyPage.menu.topbar.getTabNames()
      const activeWorkflowName = await comfyPage.menu.topbar.getActiveTabName()

      expect(tabs).toEqual(expect.arrayContaining([workflowA, workflowB]))
      expect(tabs.indexOf(workflowA)).toBeLessThan(tabs.indexOf(workflowB))
      expect(activeWorkflowName).toEqual(workflowB)
    })

    test('Restores sidebar workflows after reload', async ({ comfyPage }) => {
      await comfyPage.setSetting(
        'Comfy.Workflow.WorkflowTabsPosition',
        'Sidebar'
      )
      await comfyPage.menu.workflowsTab.open()
      const openWorkflows =
        await comfyPage.menu.workflowsTab.getOpenedWorkflowNames()
      const activeWorkflowName =
        await comfyPage.menu.workflowsTab.getActiveWorkflowName()
      const workflowPathA = `${workflowA}.json`
      const workflowPathB = `${workflowB}.json`

      expect(openWorkflows).toEqual(
        expect.arrayContaining([workflowPathA, workflowPathB])
      )
      expect(openWorkflows.indexOf(workflowPathA)).toBeLessThan(
        openWorkflows.indexOf(workflowPathB)
      )
      expect(activeWorkflowName).toEqual(workflowPathB)
    })
  })

  test('Auto fit view after loading workflow', async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.EnableWorkflowViewRestore', false)
    await comfyPage.loadWorkflow('single_ksampler')
    await expect(comfyPage.canvas).toHaveScreenshot('single_ksampler_fit.png')
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
    await comfyPage.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.loadWorkflow('single_ksampler')
    expect(await comfyPage.getGraphNodesCount()).toBe(1)
  })
})

test.describe('Viewport settings', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setSetting('Comfy.Workflow.WorkflowTabsPosition', 'Topbar')

    await comfyPage.setupWorkflowsDirectory({})
  })

  test('Keeps viewport settings when changing tabs', async ({
    comfyPage,
    comfyMouse
  }) => {
    // Screenshot the canvas element
    await comfyPage.menu.topbar.saveWorkflow('Workflow A')
    await expect(comfyPage.canvas).toHaveScreenshot('viewport-workflow-a.png')

    // Save workflow as a new file, then zoom out before screen shot
    await comfyPage.menu.topbar.saveWorkflowAs('Workflow B')
    await comfyMouse.move(comfyPage.emptySpace)
    for (let i = 0; i < 4; i++) {
      await comfyMouse.wheel(0, 60)
    }
    await expect(comfyPage.canvas).toHaveScreenshot('viewport-workflow-b.png')

    const tabA = comfyPage.menu.topbar.getWorkflowTab('Workflow A')
    const tabB = comfyPage.menu.topbar.getWorkflowTab('Workflow B')

    // Go back to Workflow A
    await tabA.click()
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot('viewport-workflow-a.png')

    // And back to Workflow B
    await tabB.click()
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot('viewport-workflow-b.png')
  })
})
