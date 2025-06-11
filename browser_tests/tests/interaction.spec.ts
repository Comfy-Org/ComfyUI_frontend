import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { PerformanceMonitor } from '../helpers/performanceMonitor'

test.describe('Item Interaction', () => {
  test('@perf Can select/delete all items', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'select-delete-all-items'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('mixed_graph_items')
    })

    await perfMonitor.measureOperation('select-all', async () => {
      await comfyPage.canvas.press('Control+a')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('selected-all.png')

    await perfMonitor.measureOperation('delete-all', async () => {
      await comfyPage.canvas.press('Delete')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('deleted-all.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can pin/unpin items with keyboard shortcut', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'pin-unpin-items-keyboard'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('mixed_graph_items')
    })

    await perfMonitor.measureOperation('select-all', async () => {
      await comfyPage.canvas.press('Control+a')
    })

    await perfMonitor.measureOperation('pin-items', async () => {
      await comfyPage.canvas.press('KeyP')
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('pinned-all.png')

    await perfMonitor.measureOperation('unpin-items', async () => {
      await comfyPage.canvas.press('KeyP')
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('unpinned-all.png')

    await perfMonitor.finishMonitoring(testName)
  })
})

test.describe('Node Interaction', () => {
  test('@perf Can enter prompt', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'enter-prompt-text'

    await perfMonitor.startMonitoring(testName)

    const textBox = comfyPage.widgetTextBox

    await perfMonitor.measureOperation('click-textbox', async () => {
      await textBox.click()
    })

    await perfMonitor.measureOperation('fill-text-initial', async () => {
      await textBox.fill('Hello World')
    })

    await expect(textBox).toHaveValue('Hello World')

    await perfMonitor.measureOperation('fill-text-update', async () => {
      await textBox.fill('Hello World 2')
    })

    await expect(textBox).toHaveValue('Hello World 2')

    await perfMonitor.finishMonitoring(testName)
  })

  test.describe('Node Selection', () => {
    const multiSelectModifiers = ['Control', 'Shift', 'Meta'] as const

    multiSelectModifiers.forEach((modifier) => {
      test(`@perf Can add multiple nodes to selection using ${modifier}+Click`, async ({
        comfyPage
      }) => {
        const perfMonitor = new PerformanceMonitor(comfyPage.page)
        const testName = `multi-select-nodes-${modifier.toLowerCase()}`

        await perfMonitor.startMonitoring(testName)

        let clipNodes: any[]
        await perfMonitor.measureOperation('get-node-refs', async () => {
          clipNodes = await comfyPage.getNodeRefsByType('CLIPTextEncode')
        })

        await perfMonitor.measureOperation('multi-select-nodes', async () => {
          for (const node of clipNodes!) {
            await node.click('title', { modifiers: [modifier] })
          }
        })

        let selectedNodeCount: number
        await perfMonitor.measureOperation('count-selected-nodes', async () => {
          selectedNodeCount = await comfyPage.getSelectedGraphNodesCount()
        })

        expect(selectedNodeCount!).toBe(clipNodes!.length)

        await perfMonitor.finishMonitoring(testName)
      })
    })

    test('@2x @perf Can highlight selected', async ({ comfyPage }) => {
      const perfMonitor = new PerformanceMonitor(comfyPage.page)
      const testName = 'highlight-selected-nodes'

      await perfMonitor.startMonitoring(testName)

      await expect(comfyPage.canvas).toHaveScreenshot('default.png')

      await perfMonitor.measureOperation('click-node1', async () => {
        await comfyPage.clickTextEncodeNode1()
      })

      await expect(comfyPage.canvas).toHaveScreenshot('selected-node1.png')

      await perfMonitor.measureOperation('click-node2', async () => {
        await comfyPage.clickTextEncodeNode2()
      })

      await expect(comfyPage.canvas).toHaveScreenshot('selected-node2.png')

      await perfMonitor.finishMonitoring(testName)
    })

    test('@perf Can drag-select nodes with Meta (mac)', async ({
      comfyPage
    }) => {
      const perfMonitor = new PerformanceMonitor(comfyPage.page)
      const testName = 'drag-select-nodes-meta'

      await perfMonitor.startMonitoring(testName)

      let clipNodes: any[]
      let clipNode1Pos: any
      let clipNode2Pos: any

      await perfMonitor.measureOperation('get-node-positions', async () => {
        clipNodes = await comfyPage.getNodeRefsByType('CLIPTextEncode')
        clipNode1Pos = await clipNodes[0].getPosition()
        clipNode2Pos = await clipNodes[1].getPosition()
      })

      const offset = 64
      await perfMonitor.measureOperation('drag-select-operation', async () => {
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
      })

      expect(await comfyPage.getSelectedGraphNodesCount()).toBe(
        clipNodes!.length
      )

      await perfMonitor.finishMonitoring(testName)
    })
  })

  test('@perf Can drag node', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'drag-node'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('drag-node-operation', async () => {
      await comfyPage.dragNode2()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('dragged-node1.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test.describe('Edge Interaction', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.LinkRelease.Action', 'no action')
      await comfyPage.setSetting('Comfy.LinkRelease.ActionShift', 'no action')
    })

    // Test both directions of edge connection.
    ;[{ reverse: false }, { reverse: true }].forEach(({ reverse }) => {
      test(`@perf Can disconnect/connect edge ${reverse ? 'reverse' : 'normal'}`, async ({
        comfyPage
      }) => {
        const perfMonitor = new PerformanceMonitor(comfyPage.page)
        const testName = `disconnect-connect-edge-${reverse ? 'reverse' : 'normal'}`

        await perfMonitor.startMonitoring(testName)

        await perfMonitor.measureOperation('disconnect-edge', async () => {
          await comfyPage.disconnectEdge()
        })

        await expect(comfyPage.canvas).toHaveScreenshot('disconnected-edge.png')

        await perfMonitor.measureOperation('connect-edge', async () => {
          await comfyPage.connectEdge({ reverse })
        })

        await perfMonitor.measureOperation('move-mouse-to-empty', async () => {
          await comfyPage.moveMouseToEmptyArea()
        })

        // Litegraph renders edge with a slight offset.
        await expect(comfyPage.canvas).toHaveScreenshot('default.png', {
          maxDiffPixels: 50
        })

        await perfMonitor.finishMonitoring(testName)
      })
    })

    test('@perf Can move link', async ({ comfyPage }) => {
      const perfMonitor = new PerformanceMonitor(comfyPage.page)
      const testName = 'move-link'

      await perfMonitor.startMonitoring(testName)

      await perfMonitor.measureOperation('disconnect-link', async () => {
        await comfyPage.dragAndDrop(
          comfyPage.clipTextEncodeNode1InputSlot,
          comfyPage.emptySpace
        )
      })

      await expect(comfyPage.canvas).toHaveScreenshot('disconnected-edge.png')

      await perfMonitor.measureOperation('move-link', async () => {
        await comfyPage.dragAndDrop(
          comfyPage.clipTextEncodeNode2InputSlot,
          comfyPage.clipTextEncodeNode1InputSlot
        )
      })

      await expect(comfyPage.canvas).toHaveScreenshot('moved-link.png')

      await perfMonitor.finishMonitoring(testName)
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

    test('@perf Auto snap&highlight when dragging link over node', async ({
      comfyPage,
      comfyMouse
    }) => {
      const perfMonitor = new PerformanceMonitor(comfyPage.page)
      const testName = 'auto-snap-highlight-drag-link'

      await perfMonitor.startMonitoring(testName)

      await perfMonitor.measureOperation('setup-snap-settings', async () => {
        await comfyPage.setSetting('Comfy.Node.AutoSnapLinkToSlot', true)
        await comfyPage.setSetting('Comfy.Node.SnapHighlightsNode', true)
      })

      await perfMonitor.measureOperation('drag-link-with-snap', async () => {
        await comfyMouse.move(comfyPage.clipTextEncodeNode1InputSlot)
        await comfyMouse.drag(comfyPage.clipTextEncodeNode2InputSlot)
      })

      await expect(comfyPage.canvas).toHaveScreenshot('snapped-highlighted.png')

      await perfMonitor.finishMonitoring(testName)
    })
  })

  test.skip('@perf Can adjust widget value', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'adjust-widget-value'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('adjust-widget-value', async () => {
      await comfyPage.adjustWidgetValue()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('adjusted-widget-value.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Link snap to slot', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'link-snap-to-slot'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('snap_to_slot')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('snap_to_slot.png')

    const outputSlotPos = {
      x: 406,
      y: 333
    }
    const samplerNodeCenterPos = {
      x: 748,
      y: 77
    }

    await perfMonitor.measureOperation('drag-link-to-snap', async () => {
      await comfyPage.dragAndDrop(outputSlotPos, samplerNodeCenterPos)
    })

    await expect(comfyPage.canvas).toHaveScreenshot('snap_to_slot_linked.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can batch move links by drag with shift', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'batch-move-links-shift-drag'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('batch_move_links')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('batch_move_links.png')

    const outputSlot1Pos = {
      x: 304,
      y: 127
    }
    const outputSlot2Pos = {
      x: 307,
      y: 310
    }

    await perfMonitor.measureOperation('batch-move-links', async () => {
      await comfyPage.page.keyboard.down('Shift')
      await comfyPage.dragAndDrop(outputSlot1Pos, outputSlot2Pos)
      await comfyPage.page.keyboard.up('Shift')
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'batch_move_links_moved.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can batch disconnect links with ctrl+alt+click', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'batch-disconnect-links-ctrl-alt-click'

    await perfMonitor.startMonitoring(testName)

    const loadCheckpointClipSlotPos = {
      x: 332,
      y: 508
    }

    await perfMonitor.measureOperation('batch-disconnect-links', async () => {
      await comfyPage.canvas.click({
        modifiers: ['Control', 'Alt'],
        position: loadCheckpointClipSlotPos
      })
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'batch-disconnect-links-disconnected.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can toggle dom widget node open/closed', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'toggle-dom-widget-node'

    await perfMonitor.startMonitoring(testName)

    await expect(comfyPage.canvas).toHaveScreenshot('default.png')

    await perfMonitor.measureOperation('toggle-node-closed', async () => {
      await comfyPage.clickTextEncodeNodeToggler()
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'text-encode-toggled-off.png'
    )

    await comfyPage.delay(1000)

    await perfMonitor.measureOperation('toggle-node-open', async () => {
      await comfyPage.clickTextEncodeNodeToggler()
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'text-encode-toggled-back-open.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })

  // Skip because fails with vue widget nodes (reason not investigated)
  test.skip('Can close prompt dialog with canvas click (number widget)', async ({
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

  // Skip because fails with vue widget nodes (reason not investigated)
  test.skip('Can close prompt dialog with canvas click (text widget)', async ({
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

  test('@perf Can double click node title to edit', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'edit-node-title-double-click'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('single_ksampler')
    })

    await perfMonitor.measureOperation('activate-title-edit', async () => {
      await comfyPage.canvas.dblclick({
        position: {
          x: 50,
          y: 10
        },
        delay: 5
      })
    })

    await perfMonitor.measureOperation('type-title-text', async () => {
      await comfyPage.page.keyboard.type('Hello World')
      await comfyPage.page.keyboard.press('Enter')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('node-title-edited.png')

    await perfMonitor.finishMonitoring(testName)
  })

  // Skip because fails with vue widget nodes (reason not investigated)
  test.skip('Double click node body does not trigger edit', async ({
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

  test('@perf Can group selected nodes', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'group-selected-nodes'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('setup-group-setting', async () => {
      await comfyPage.setSetting('Comfy.GroupSelectedNodes.Padding', 10)
    })

    await perfMonitor.measureOperation('select-nodes', async () => {
      await comfyPage.select2Nodes()
    })

    await perfMonitor.measureOperation('create-group', async () => {
      await comfyPage.page.keyboard.down('Control')
      await comfyPage.page.keyboard.press('KeyG')
      await comfyPage.page.keyboard.up('Control')
      await comfyPage.nextFrame()
    })

    await perfMonitor.measureOperation('confirm-group-title', async () => {
      await comfyPage.page.keyboard.press('Enter')
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('group-selected-nodes.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can fit group to contents', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'fit-group-to-contents'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('oversized_group')
    })

    await perfMonitor.measureOperation('select-all', async () => {
      await comfyPage.ctrlA()
      await comfyPage.nextFrame()
    })

    await perfMonitor.measureOperation('fit-group-to-contents', async () => {
      await comfyPage.executeCommand('Comfy.Graph.FitGroupToContents')
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('group-fit-to-contents.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can pin/unpin nodes', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'pin-unpin-nodes-command'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('select-nodes', async () => {
      await comfyPage.select2Nodes()
    })

    await perfMonitor.measureOperation('pin-nodes', async () => {
      await comfyPage.executeCommand('Comfy.Canvas.ToggleSelectedNodes.Pin')
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('nodes-pinned.png')

    await perfMonitor.measureOperation('unpin-nodes', async () => {
      await comfyPage.executeCommand('Comfy.Canvas.ToggleSelectedNodes.Pin')
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('nodes-unpinned.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can bypass/unbypass nodes with keyboard shortcut', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'bypass-unbypass-nodes-keyboard'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('select-nodes', async () => {
      await comfyPage.select2Nodes()
    })

    await perfMonitor.measureOperation('bypass-nodes', async () => {
      await comfyPage.canvas.press('Control+b')
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('nodes-bypassed.png')

    await perfMonitor.measureOperation('unbypass-nodes', async () => {
      await comfyPage.canvas.press('Control+b')
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('nodes-unbypassed.png')

    await perfMonitor.finishMonitoring(testName)
  })
})

test.describe('Group Interaction', () => {
  test('@perf Can double click group title to edit', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'edit-group-title-double-click'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('single_group')
    })

    await perfMonitor.measureOperation('activate-title-edit', async () => {
      await comfyPage.canvas.dblclick({
        position: {
          x: 50,
          y: 10
        },
        delay: 5
      })
    })

    await perfMonitor.measureOperation('type-title-text', async () => {
      await comfyPage.page.keyboard.type('Hello World')
      await comfyPage.page.keyboard.press('Enter')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('group-title-edited.png')

    await perfMonitor.finishMonitoring(testName)
  })
})

test.describe('Canvas Interaction', () => {
  test('@perf Can zoom in/out', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'zoom-in-out-canvas'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('zoom-in', async () => {
      await comfyPage.zoom(-100)
    })

    await expect(comfyPage.canvas).toHaveScreenshot('zoomed-in.png')

    await perfMonitor.measureOperation('zoom-out', async () => {
      await comfyPage.zoom(200)
    })

    await expect(comfyPage.canvas).toHaveScreenshot('zoomed-out.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can zoom very far out', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'zoom-very-far-out-canvas'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('zoom-very-far-out', async () => {
      await comfyPage.zoom(100, 12)
    })

    await expect(comfyPage.canvas).toHaveScreenshot('zoomed-very-far-out.png')

    await perfMonitor.measureOperation('zoom-back-in', async () => {
      await comfyPage.zoom(-100, 12)
    })

    await expect(comfyPage.canvas).toHaveScreenshot('zoomed-back-in.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can zoom in/out with ctrl+shift+vertical-drag', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'zoom-ctrl-shift-vertical-drag'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('zoom-in-ctrl-shift-drag', async () => {
      await comfyPage.page.keyboard.down('Control')
      await comfyPage.page.keyboard.down('Shift')
      await comfyPage.dragAndDrop({ x: 10, y: 100 }, { x: 10, y: 40 })
    })

    await expect(comfyPage.canvas).toHaveScreenshot('zoomed-in-ctrl-shift.png')

    await perfMonitor.measureOperation('zoom-out-ctrl-shift-drag', async () => {
      await comfyPage.dragAndDrop({ x: 10, y: 40 }, { x: 10, y: 160 })
    })

    await expect(comfyPage.canvas).toHaveScreenshot('zoomed-out-ctrl-shift.png')

    await perfMonitor.measureOperation(
      'zoom-default-ctrl-shift-drag',
      async () => {
        await comfyPage.dragAndDrop({ x: 10, y: 280 }, { x: 10, y: 220 })
        await comfyPage.page.keyboard.up('Control')
        await comfyPage.page.keyboard.up('Shift')
      }
    )

    await expect(comfyPage.canvas).toHaveScreenshot(
      'zoomed-default-ctrl-shift.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can zoom in/out after decreasing canvas zoom speed setting', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'zoom-low-speed-setting'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('set-low-zoom-speed', async () => {
      await comfyPage.setSetting('Comfy.Graph.ZoomSpeed', 1.05)
    })

    await perfMonitor.measureOperation('zoom-in-low-speed', async () => {
      await comfyPage.zoom(-100, 4)
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'zoomed-in-low-zoom-speed.png'
    )

    await perfMonitor.measureOperation('zoom-out-low-speed', async () => {
      await comfyPage.zoom(100, 8)
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'zoomed-out-low-zoom-speed.png'
    )

    await perfMonitor.measureOperation('reset-zoom-speed', async () => {
      await comfyPage.setSetting('Comfy.Graph.ZoomSpeed', 1.1)
    })

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can zoom in/out after increasing canvas zoom speed', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'zoom-high-speed-setting'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('set-high-zoom-speed', async () => {
      await comfyPage.setSetting('Comfy.Graph.ZoomSpeed', 1.5)
    })

    await perfMonitor.measureOperation('zoom-in-high-speed', async () => {
      await comfyPage.zoom(-100, 4)
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'zoomed-in-high-zoom-speed.png'
    )

    await perfMonitor.measureOperation('zoom-out-high-speed', async () => {
      await comfyPage.zoom(100, 8)
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'zoomed-out-high-zoom-speed.png'
    )

    await perfMonitor.measureOperation('reset-zoom-speed', async () => {
      await comfyPage.setSetting('Comfy.Graph.ZoomSpeed', 1.1)
    })

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can pan', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'pan-canvas'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('pan-canvas', async () => {
      await comfyPage.pan({ x: 200, y: 200 })
    })

    await expect(comfyPage.canvas).toHaveScreenshot('panned.png')

    await perfMonitor.finishMonitoring(testName)
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

  test('@perf Can pan when dragging a link', async ({
    comfyPage,
    comfyMouse
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'pan-while-dragging-link'

    await perfMonitor.startMonitoring(testName)

    const posSlot1 = comfyPage.clipTextEncodeNode1InputSlot
    const posEmpty = comfyPage.emptySpace

    await perfMonitor.measureOperation('start-drag-link', async () => {
      await comfyMouse.move(posSlot1)
      await comfyMouse.drag(posEmpty)
    })

    await expect(comfyPage.canvas).toHaveScreenshot('dragging-link1.png')

    await perfMonitor.measureOperation('pan-while-dragging', async () => {
      await comfyPage.page.keyboard.down('Space')
      await comfyMouse.mouse.move(posEmpty.x + 100, posEmpty.y + 100)
    })

    // Canvas should be panned.
    await expect(comfyPage.canvas).toHaveScreenshot(
      'panning-when-dragging-link.png'
    )

    await perfMonitor.measureOperation('return-to-drag-mode', async () => {
      await comfyPage.page.keyboard.up('Space')
      await comfyMouse.move(posEmpty)
    })

    // Should be back to dragging link mode when space is released.
    await expect(comfyPage.canvas).toHaveScreenshot('dragging-link2.png')

    await comfyMouse.drop()

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can pan very far and back', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'pan-very-far-and-back'

    await perfMonitor.startMonitoring(testName)

    // intentionally slice the edge of where the clip text encode dom widgets are
    await perfMonitor.measureOperation('pan-step-one', async () => {
      await comfyPage.pan({ x: -800, y: -300 }, { x: 1000, y: 10 })
    })

    await expect(comfyPage.canvas).toHaveScreenshot('panned-step-one.png')

    await perfMonitor.measureOperation('pan-step-two', async () => {
      await comfyPage.pan({ x: -200, y: 0 }, { x: 1000, y: 10 })
    })

    await expect(comfyPage.canvas).toHaveScreenshot('panned-step-two.png')

    await perfMonitor.measureOperation('pan-far-away', async () => {
      await comfyPage.pan({ x: -2200, y: -2200 }, { x: 1000, y: 10 })
    })

    await expect(comfyPage.canvas).toHaveScreenshot('panned-far-away.png')

    await perfMonitor.measureOperation('pan-back-from-far', async () => {
      await comfyPage.pan({ x: 2200, y: 2200 }, { x: 1000, y: 10 })
    })

    await expect(comfyPage.canvas).toHaveScreenshot('panned-back-from-far.png')

    await perfMonitor.measureOperation('pan-back-to-two', async () => {
      await comfyPage.pan({ x: 200, y: 0 }, { x: 1000, y: 10 })
    })

    await expect(comfyPage.canvas).toHaveScreenshot('panned-back-to-two.png')

    await perfMonitor.measureOperation('pan-back-to-one', async () => {
      await comfyPage.pan({ x: 800, y: 300 }, { x: 1000, y: 10 })
    })

    await expect(comfyPage.canvas).toHaveScreenshot('panned-back-to-one.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test.skip('@mobile @perf Can pan with touch', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'pan-with-touch-mobile'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('close-menu', async () => {
      await comfyPage.closeMenu()
    })

    await perfMonitor.measureOperation('pan-with-touch', async () => {
      await comfyPage.panWithTouch({ x: 200, y: 200 })
    })

    await expect(comfyPage.canvas).toHaveScreenshot('panned-touch.png')

    await perfMonitor.finishMonitoring(testName)
  })
})

test.describe('Widget Interaction', () => {
  test('@perf Undo text input', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'undo-text-input-widget'

    await perfMonitor.startMonitoring(testName)

    const textBox = comfyPage.widgetTextBox

    await perfMonitor.measureOperation('click-and-clear-textbox', async () => {
      await textBox.click()
      await textBox.fill('')
    })

    await expect(textBox).toHaveValue('')

    await perfMonitor.measureOperation('fill-text', async () => {
      await textBox.fill('Hello World')
    })

    await expect(textBox).toHaveValue('Hello World')

    await perfMonitor.measureOperation('undo-text-input', async () => {
      await comfyPage.ctrlZ(null)
    })

    await expect(textBox).toHaveValue('')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Undo attention edit', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'undo-attention-edit-widget'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('setup-attention-delta', async () => {
      await comfyPage.setSetting('Comfy.EditAttention.Delta', 0.05)
    })

    const textBox = comfyPage.widgetTextBox

    await perfMonitor.measureOperation('fill-text', async () => {
      await textBox.click()
      await textBox.fill('1girl')
    })

    await expect(textBox).toHaveValue('1girl')

    await perfMonitor.measureOperation('edit-attention', async () => {
      await textBox.selectText()
      await comfyPage.ctrlArrowUp(null)
    })

    await expect(textBox).toHaveValue('(1girl:1.05)')

    await perfMonitor.measureOperation('undo-attention-edit', async () => {
      await comfyPage.ctrlZ(null)
    })

    await expect(textBox).toHaveValue('1girl')

    await perfMonitor.finishMonitoring(testName)
  })
})

test.describe('Load workflow', () => {
  test('@perf Can load workflow with string node id', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'load-workflow-string-node-id'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('string_node_id')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('string_node_id.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can load workflow with ("STRING",) input node', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'load-workflow-string-input'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('string_input')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('string_input.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Restore workflow on reload (switch workflow)', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'restore-workflow-on-reload-switch'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-initial-workflow', async () => {
      await comfyPage.loadWorkflow('single_ksampler')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('single_ksampler.png')

    await perfMonitor.measureOperation(
      'reload-page-preserve-storage',
      async () => {
        await comfyPage.setup({ clearStorage: false })
      }
    )

    await expect(comfyPage.canvas).toHaveScreenshot('single_ksampler.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Restore workflow on reload (modify workflow)', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'restore-workflow-on-reload-modify'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('single_ksampler')
    })

    let node: any
    await perfMonitor.measureOperation('get-node-ref', async () => {
      node = (await comfyPage.getFirstNodeRef())!
    })

    await perfMonitor.measureOperation('modify-node', async () => {
      await node.click('collapse')
      // Wait 300ms between 2 clicks so that it is not treated as a double click
      // by litegraph.
      await comfyPage.page.waitForTimeout(300)
      await comfyPage.clickEmptySpace()
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'single_ksampler_modified.png'
    )

    await perfMonitor.measureOperation(
      'reload-page-preserve-storage',
      async () => {
        await comfyPage.setup({ clearStorage: false })
      }
    )

    await expect(comfyPage.canvas).toHaveScreenshot(
      'single_ksampler_modified.png'
    )

    await perfMonitor.finishMonitoring(testName)
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

  test('@perf Auto fit view after loading workflow', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'auto-fit-view-after-load-workflow'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('disable-view-restore', async () => {
      await comfyPage.setSetting('Comfy.EnableWorkflowViewRestore', false)
    })

    await perfMonitor.measureOperation(
      'load-workflow-with-auto-fit',
      async () => {
        await comfyPage.loadWorkflow('single_ksampler')
      }
    )

    await expect(comfyPage.canvas).toHaveScreenshot('single_ksampler_fit.png')

    await perfMonitor.finishMonitoring(testName)
  })
})

test.describe('Load duplicate workflow', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test('@perf A workflow can be loaded multiple times in a row', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'load-duplicate-workflow-multiple-times'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-first-workflow', async () => {
      await comfyPage.loadWorkflow('single_ksampler')
    })

    await perfMonitor.measureOperation('open-workflows-tab', async () => {
      await comfyPage.menu.workflowsTab.open()
    })

    await perfMonitor.measureOperation(
      'create-new-blank-workflow',
      async () => {
        await comfyPage.executeCommand('Comfy.NewBlankWorkflow')
      }
    )

    await perfMonitor.measureOperation('load-second-workflow', async () => {
      await comfyPage.loadWorkflow('single_ksampler')
    })

    expect(await comfyPage.getGraphNodesCount()).toBe(1)

    await perfMonitor.finishMonitoring(testName)
  })
})

test.describe('Viewport settings', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setSetting('Comfy.Workflow.WorkflowTabsPosition', 'Topbar')

    await comfyPage.setupWorkflowsDirectory({})
  })

  test.skip('@perf Keeps viewport settings when changing tabs', async ({
    comfyPage,
    comfyMouse
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'viewport-settings-tab-switching'

    await perfMonitor.startMonitoring(testName)

    // Screenshot the canvas element
    await perfMonitor.measureOperation('save-workflow-a', async () => {
      await comfyPage.menu.topbar.saveWorkflow('Workflow A')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('viewport-workflow-a.png')

    // Save workflow as a new file, then zoom out before screen shot
    await perfMonitor.measureOperation('save-workflow-b', async () => {
      await comfyPage.menu.topbar.saveWorkflowAs('Workflow B')
    })

    await perfMonitor.measureOperation('zoom-out-workflow-b', async () => {
      await comfyMouse.move(comfyPage.emptySpace)
      for (let i = 0; i < 4; i++) {
        await comfyMouse.wheel(0, 60)
      }
    })

    await expect(comfyPage.canvas).toHaveScreenshot('viewport-workflow-b.png')

    const tabA = comfyPage.menu.topbar.getWorkflowTab('Workflow A')
    const tabB = comfyPage.menu.topbar.getWorkflowTab('Workflow B')

    // Go back to Workflow A
    await perfMonitor.measureOperation('switch-to-workflow-a', async () => {
      await tabA.click()
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('viewport-workflow-a.png')

    // And back to Workflow B
    await perfMonitor.measureOperation('switch-to-workflow-b', async () => {
      await tabB.click()
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('viewport-workflow-b.png')

    await perfMonitor.finishMonitoring(testName)
  })
})
