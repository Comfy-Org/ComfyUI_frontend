import { expect } from '@playwright/test'
import type { Position } from '@vueuse/core'

import {
  comfyPageFixture as test,
  testComfySnapToGridGridSize
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { DefaultGraphPositions } from '@e2e/fixtures/constants/defaultGraphPositions'
import { TestIds } from '@e2e/fixtures/selectors'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'
import {
  expectElementScreenshot,
  expectRegionScreenshot,
  graphItems,
  screenshotRegion
} from '@e2e/fixtures/utils/screenshotRegion'
import type { WorkspaceStore } from '@e2e/types/globals'

test.use({ initialSettings: { 'Comfy.UseNewMenu': 'Disabled' } })

async function clipLinkTargets(
  comfyPage: ComfyPage,
  ...extraPoints: Position[]
) {
  return [
    await comfyPage.nodeOps.getNodeRefByType('CheckpointLoaderSimple'),
    ...(await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')),
    ...extraPoints
  ]
}

test.describe('Item Interaction', { tag: ['@node'] }, () => {
  test(
    'Can select/delete all items',
    { tag: ['@screenshot'] },
    async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('groups/mixed_graph_items')
      const region = await screenshotRegion(comfyPage.page, [
        graphItems(comfyPage.page, 'all')
      ])
      await comfyPage.canvas.press('Control+a')
      await region.expectScreenshot('selected-all.png')
      await comfyPage.canvas.press('Delete')
      await region.expectScreenshot('deleted-all.png')
    }
  )

  test('A pinned node resists dragging and stays pinned across a reload', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')

    const title = 'KSampler'
    async function readPos() {
      const node = await comfyPage.nodeOps.getNodeRefByTitle(title)
      return node.getProperty<[number, number]>('pos')
    }

    const node = await comfyPage.nodeOps.getNodeRefByTitle(title)
    const pinnedOrigin = await readPos()

    const dragDelta = { x: 90, y: 70 }

    await test.step('Pinned node resists dragging', async () => {
      await comfyPage.nodeOps.selectNodes([title])
      await comfyPage.command.executeCommand(
        'Comfy.Canvas.ToggleSelectedNodes.Pin'
      )
      await expect.poll(() => node.isPinned()).toBe(true)

      await node.dragBy(dragDelta)
      await expect.poll(readPos).toEqual(pinnedOrigin)
    })

    const movedPos =
      await test.step('Unpinned node moves with the same drag', async () => {
        // Control: the same gesture must move the node once it is unpinned.
        // Without this, "did not move" could simply mean the drag never landed.
        await comfyPage.command.executeCommand(
          'Comfy.Canvas.ToggleSelectedNodes.Pin'
        )
        await expect.poll(() => node.isPinned()).toBe(false)
        await node.dragBy(dragDelta)
        await expect.poll(readPos).not.toEqual(pinnedOrigin)
        return await readPos()
      })

    await test.step('Repin and save the moved node', async () => {
      const beforeRepin = Date.now()
      await comfyPage.command.executeCommand(
        'Comfy.Canvas.ToggleSelectedNodes.Pin'
      )
      await expect.poll(() => node.isPinned()).toBe(true)
      await comfyPage.workflow.waitForDraftIndexUpdatedSince(beforeRepin)
    })

    await test.step('Reload restores the pinned node at its moved position', async () => {
      await comfyPage.workflow.reloadAndWaitForApp()

      const reloaded = await comfyPage.nodeOps.getNodeRefByTitle(title)
      expect(reloaded.id).toBe(node.id)
      await expect.poll(() => reloaded.isPinned()).toBe(true)
      await expect.poll(readPos).toEqual(movedPos)
    })
  })

  test(
    'Can pin/unpin items with keyboard shortcut',
    { tag: ['@screenshot'] },
    async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('groups/mixed_graph_items')
      const region = await screenshotRegion(comfyPage.page, [
        graphItems(comfyPage.page, 'all')
      ])
      await comfyPage.canvas.press('Control+a')
      await comfyPage.keyboard.press('KeyP')
      await region.expectScreenshot('pinned-all.png')
      await comfyPage.keyboard.press('KeyP')
      await region.expectScreenshot('unpinned-all.png')
    }
  )
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
        const clipNodes =
          await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
        for (const node of clipNodes) {
          await node.click('title', { modifiers: [modifier] })
        }
        await expect
          .poll(() => comfyPage.nodeOps.getSelectedGraphNodesCount())
          .toBe(clipNodes.length)
      })
    })

    test(
      '@2x Can highlight selected',
      { tag: '@screenshot' },
      async ({ comfyPage }) => {
        const region = await screenshotRegion(
          comfyPage.page,
          await clipLinkTargets(comfyPage)
        )
        await region.expectScreenshot('default.png')
        await comfyPage.canvas.click({
          position: DefaultGraphPositions.textEncodeNode1
        })
        await region.expectScreenshot('selected-node1.png')
        await comfyPage.canvas.click({
          position: DefaultGraphPositions.textEncodeNode2
        })
        await region.expectScreenshot('selected-node2.png')
      }
    )

    const dragSelectNodes = async (
      comfyPage: ComfyPage,
      clipNodes: NodeReference[]
    ) => {
      const clipNode1Pos = await clipNodes[0].getPosition()
      const clipNode2Pos = await clipNodes[1].getPosition()
      const offset = 64
      await comfyPage.page.keyboard.down('Meta')
      await comfyPage.canvasOps.dragAndDrop(
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
      const clipNodes =
        await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
      await dragSelectNodes(comfyPage, clipNodes)
      await expect
        .poll(() => comfyPage.nodeOps.getSelectedGraphNodesCount())
        .toBe(clipNodes.length)
    })

    test('Can move selected nodes using the Comfy.Canvas.MoveSelectedNodes.{Up|Down|Left|Right} commands', async ({
      comfyPage
    }) => {
      const clipNodes =
        await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
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
        await comfyPage.command.executeCommand(
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

  test.describe('Node Duplication', () => {
    test('Can duplicate a regular node via Alt+drag', async ({ comfyPage }) => {
      const before = await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
      expect(
        before,
        'Expected exactly 2 CLIPTextEncode nodes in default graph'
      ).toHaveLength(2)

      const target = before[0]
      const pos = await target.getPosition()
      const src = { x: pos.x + 16, y: pos.y + 16 }

      await comfyPage.page.mouse.move(src.x, src.y)
      await comfyPage.page.keyboard.down('Alt')
      try {
        await comfyPage.page.mouse.down()
        await comfyPage.nextFrame()
        await comfyPage.page.mouse.move(src.x + 120, src.y + 80, { steps: 20 })
        await comfyPage.page.mouse.up()
        await comfyPage.nextFrame()
      } finally {
        await comfyPage.page.keyboard.up('Alt')
      }
      await comfyPage.canvasOps.moveMouseToEmptyArea()

      await expect
        .poll(
          async () =>
            (await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')).length
        )
        .toBe(3)
      expect(await target.exists()).toBe(true)
    })
  })

  test.describe('Edge Interaction', { tag: '@screenshot' }, () => {
    test.use({
      initialSettings: {
        'Comfy.UseNewMenu': 'Disabled',
        'Comfy.LinkRelease.Action': 'no action',
        'Comfy.LinkRelease.ActionShift': 'no action'
      }
    })

    ;[{ reverse: false }, { reverse: true }].forEach(({ reverse }) => {
      test(`Can disconnect/connect edge ${reverse ? 'reverse' : 'normal'}`, async ({
        comfyPage
      }) => {
        const region = await screenshotRegion(
          comfyPage.page,
          await clipLinkTargets(comfyPage)
        )
        await comfyPage.canvasOps.disconnectEdge()
        await region.expectScreenshot('disconnected-edge.png')
        await comfyPage.canvasOps.connectEdge({ reverse })
        await comfyPage.canvasOps.moveMouseToEmptyArea()
        await region.expectScreenshot('default.png', { maxDiffPixels: 50 })
      })
    })

    test('Repeated disconnect/connect leaves exactly one link', async ({
      comfyPage
    }) => {
      test.slow()
      await comfyPage.workflow.loadWorkflow('default')

      const checkpoint = await comfyPage.nodeOps.getNodeRefByType(
        'CheckpointLoaderSimple'
      )
      const clipOutput = await checkpoint.getOutput(1)
      const targetNode = await comfyPage.nodeOps.getNodeRefById(6)
      const targetInput = await targetNode.getInputByName('clip')
      const targetLink = await targetInput.getLink()
      if (!targetLink) throw new Error('Default workflow link not found')

      const targetEndpoints = {
        origin_id: targetLink.origin_id,
        origin_slot: targetLink.origin_slot,
        target_id: targetLink.target_id,
        target_slot: targetLink.target_slot
      }
      const initial = await clipOutput.getLinkCount()
      expect(initial, 'default workflow should have links').toBeGreaterThan(0)

      for (let cycle = 0; cycle < 5; cycle++) {
        await comfyPage.canvasOps.disconnectEdge()
        await clipOutput.expectLinkCount(initial - 1)
        await expect.poll(() => targetInput.getLink()).toBeNull()
        await comfyPage.canvasOps.connectEdge()
        await clipOutput.expectLinkCount(initial)
        await expect
          .poll(() => targetInput.getLink())
          .toMatchObject(targetEndpoints)
      }

      // End disconnected so the reload assertion cannot pass by restoring a
      // pristine default instead of the edited draft.
      await comfyPage.canvasOps.disconnectEdge()
      await comfyPage.canvasOps.moveMouseToEmptyArea()
      await clipOutput.expectLinkCount(initial - 1)
      await expect.poll(() => targetInput.getLink()).toBeNull()

      await comfyPage.workflow.reloadAndWaitForApp()
      await clipOutput.expectLinkCount(initial - 1)
      await expect.poll(() => targetInput.getLink()).toBeNull()
    })

    test('Can move link', async ({ comfyPage }) => {
      const region = await screenshotRegion(
        comfyPage.page,
        await clipLinkTargets(comfyPage)
      )
      await comfyPage.canvasOps.dragAndDrop(
        DefaultGraphPositions.clipTextEncodeNode1InputSlot,
        DefaultGraphPositions.emptySpace
      )
      await region.expectScreenshot('disconnected-edge.png')
      await comfyPage.canvasOps.dragAndDrop(
        DefaultGraphPositions.clipTextEncodeNode2InputSlot,
        DefaultGraphPositions.clipTextEncodeNode1InputSlot
      )
      await region.expectScreenshot('moved-link.png')
    })

    test('Can copy link by shift-drag existing link', async ({ comfyPage }) => {
      const region = await screenshotRegion(
        comfyPage.page,
        await clipLinkTargets(comfyPage)
      )
      await comfyPage.canvasOps.dragAndDrop(
        DefaultGraphPositions.clipTextEncodeNode1InputSlot,
        DefaultGraphPositions.emptySpace
      )
      await region.expectScreenshot('disconnected-edge.png')
      await comfyPage.page.keyboard.down('Shift')
      await comfyPage.canvasOps.dragAndDrop(
        DefaultGraphPositions.clipTextEncodeNode2InputLinkPath,
        DefaultGraphPositions.clipTextEncodeNode1InputSlot
      )
      await comfyPage.page.keyboard.up('Shift')
      await region.expectScreenshot('copied-link.png')
    })

    test('Auto snap&highlight when dragging link over node', async ({
      comfyPage,
      comfyMouse
    }) => {
      await comfyPage.settings.setSetting('Comfy.Node.AutoSnapLinkToSlot', true)
      await comfyPage.settings.setSetting('Comfy.Node.SnapHighlightsNode', true)

      const region = await screenshotRegion(
        comfyPage.page,
        await clipLinkTargets(comfyPage)
      )
      await comfyMouse.move(DefaultGraphPositions.clipTextEncodeNode1InputSlot)
      await comfyMouse.drag(DefaultGraphPositions.clipTextEncodeNode2InputSlot)
      await region.expectScreenshot('snapped-highlighted.png')
    })
  })

  test(
    'Can adjust widget value',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.nodeOps.adjustEmptyLatentWidth()
      await expectRegionScreenshot(
        comfyPage.page,
        [await comfyPage.nodeOps.getNodeRefByType('EmptyLatentImage')],
        'adjusted-widget-value.png'
      )
    }
  )

  test('Link snap to slot', { tag: '@screenshot' }, async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('links/snap_to_slot')
    const region = await screenshotRegion(comfyPage.page, [
      graphItems(comfyPage.page, 'all')
    ])
    await region.expectScreenshot('snap_to_slot.png')

    const outputSlotPos = {
      x: 406,
      y: 333
    }
    const samplerNodeCenterPos = {
      x: 748,
      y: 77
    }
    await comfyPage.canvasOps.dragAndDrop(outputSlotPos, samplerNodeCenterPos)

    await region.expectScreenshot('snap_to_slot_linked.png')
  })

  test(
    'Can batch move links by drag with shift',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('links/batch_move_links')
      const region = await screenshotRegion(comfyPage.page, [
        graphItems(comfyPage.page, 'all')
      ])
      await region.expectScreenshot('batch_move_links.png')

      const outputSlot1Pos = {
        x: 304,
        y: 127
      }
      const outputSlot2Pos = {
        x: 307,
        y: 310
      }

      await comfyPage.page.keyboard.down('Shift')
      await comfyPage.canvasOps.dragAndDrop(outputSlot1Pos, outputSlot2Pos)
      await comfyPage.page.keyboard.up('Shift')

      await region.expectScreenshot('batch_move_links_moved.png')
    }
  )

  test(
    'Can batch disconnect links with ctrl+alt+click',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      const region = await screenshotRegion(
        comfyPage.page,
        await clipLinkTargets(comfyPage)
      )
      const loadCheckpointClipSlotPos = {
        x: 332,
        y: 508
      }
      await comfyPage.canvas.click({
        modifiers: ['Control', 'Alt'],
        position: loadCheckpointClipSlotPos
      })
      await region.expectScreenshot('batch-disconnect-links-disconnected.png')
    }
  )

  test(
    'Can toggle dom widget node open/closed',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      const DOUBLE_CLICK_TIME = 100
      await comfyPage.settings.setSetting(
        'Comfy.Pointer.DoubleClickTime',
        DOUBLE_CLICK_TIME
      )
      // Find the node whose collapse toggler matches the hardcoded position.
      // getNodeRefsByType order is non-deterministic, so identify by proximity.
      const nodes = await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
      const togglerPos = DefaultGraphPositions.textEncodeNodeToggler
      let targetNode = nodes[0]
      let minDist = Infinity
      for (const n of nodes) {
        const pos = await n.getPosition()
        const dist = Math.hypot(pos.x - togglerPos.x, pos.y - togglerPos.y)
        if (dist < minDist) {
          minDist = dist
          targetNode = n
        }
      }

      const region = await screenshotRegion(
        comfyPage.page,
        await clipLinkTargets(comfyPage)
      )
      await region.expectScreenshot('default.png')
      await comfyPage.canvas.click({
        position: togglerPos
      })
      const firstClickAt = await comfyPage.page.evaluate(() =>
        performance.now()
      )
      await expect.poll(() => targetNode.isCollapsed()).toBe(true)
      await region.expectScreenshot('text-encode-toggled-off.png')
      await expect
        .poll(
          () =>
            comfyPage.page.evaluate(
              (since) => performance.now() - since,
              firstClickAt
            ),
          { message: 'double-click window after the first toggle has elapsed' }
        )
        .toBeGreaterThan(DOUBLE_CLICK_TIME)
      await comfyPage.canvas.click({
        position: togglerPos
      })
      await expect.poll(() => targetNode.isCollapsed()).toBe(false)
      await comfyPage.canvasOps.moveMouseToEmptyArea()
      await region.expectScreenshot('text-encode-toggled-back-open.png')
    }
  )

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
    const legacyPrompt = comfyPage.page.locator('.graphdialog')
    await expect(legacyPrompt).toBeVisible()
    // LiteGraph's graphdialog has a 256ms dismiss guard (Date.now() - clickTime > 256).
    // Retry the canvas click until the dialog actually closes.
    await expect(async () => {
      await comfyPage.canvas.click({
        position: {
          x: 10,
          y: 10
        }
      })
      await expect(legacyPrompt).toBeHidden({ timeout: 500 })
    }).toPass({ timeout: 5000 })
  })

  test('Can close prompt dialog with canvas click (text widget)', async ({
    comfyPage
  }) => {
    const textWidgetPos = {
      x: 167,
      y: 143
    }
    await comfyPage.workflow.loadWorkflow('nodes/single_save_image_node')
    await comfyPage.canvas.click({
      position: textWidgetPos
    })
    const legacyPrompt = comfyPage.page.locator('.graphdialog')
    await expect(legacyPrompt).toBeVisible()
    // LiteGraph's graphdialog has a 256ms dismiss guard (Date.now() - clickTime > 256).
    // Retry the canvas click until the dialog actually closes.
    await expect(async () => {
      await comfyPage.canvas.click({
        position: {
          x: 10,
          y: 10
        }
      })
      await expect(legacyPrompt).toBeHidden({ timeout: 500 })
    }).toPass({ timeout: 5000 })
  })

  test(
    'Can double click node title to edit',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
      await comfyPage.canvas.dblclick({
        position: {
          x: 50,
          y: 10
        },
        delay: 5
      })
      await comfyPage.page.keyboard.type('Hello World')
      await comfyPage.page.keyboard.press('Enter')
      await expectRegionScreenshot(
        comfyPage.page,
        [graphItems(comfyPage.page, 'all')],
        'node-title-edited.png'
      )
    }
  )

  test('Double click node body does not trigger edit', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await comfyPage.canvas.dblclick({
      position: {
        x: 50,
        y: 50
      },
      delay: 5
    })
    await expect(comfyPage.page.locator('.node-title-editor')).toHaveCount(0)
  })

  test(
    'Can group selected nodes',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.GroupSelectedNodes.Padding',
        10
      )
      await comfyPage.nodeOps.selectNodes(['CLIP Text Encode (Prompt)'])
      await comfyPage.page.keyboard.down('Control')
      await comfyPage.page.keyboard.press('KeyG')
      await comfyPage.page.keyboard.up('Control')
      await comfyPage.nextFrame()
      await comfyPage.keyboard.press('Enter')
      await expectRegionScreenshot(
        comfyPage.page,
        [graphItems(comfyPage.page, 'groups')],
        'group-selected-nodes.png'
      )
    }
  )

  test(
    'Can fit group to contents',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('groups/oversized_group')
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const group = window.app!.graph.groups[0]
            return [group.size[0], group.size[1]]
          })
        )
        .not.toBeNull()

      const initialGroupSize = await comfyPage.page.evaluate(() => {
        const group = window.app!.graph.groups[0]
        return [group.size[0], group.size[1]]
      })

      await comfyPage.keyboard.selectAll()
      await comfyPage.nextFrame()
      await comfyPage.command.executeCommand('Comfy.Graph.FitGroupToContents')
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const group = window.app!.graph.groups[0]
            return [group.size[0], group.size[1]]
          })
        )
        .not.toEqual(initialGroupSize)
      await expectRegionScreenshot(
        comfyPage.page,
        [graphItems(comfyPage.page, 'all')],
        'group-fit-to-contents.png'
      )
    }
  )

  test('Can pin/unpin nodes', { tag: '@screenshot' }, async ({ comfyPage }) => {
    await comfyPage.nodeOps.selectNodes(['CLIP Text Encode (Prompt)'])
    const nodeRef = (
      await comfyPage.nodeOps.getNodeRefsByTitle('CLIP Text Encode (Prompt)')
    )[0]

    await comfyPage.command.executeCommand(
      'Comfy.Canvas.ToggleSelectedNodes.Pin'
    )
    const region = await screenshotRegion(
      comfyPage.page,
      await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
    )
    await expect.poll(() => nodeRef.isPinned()).toBe(true)
    await region.expectScreenshot('nodes-pinned.png')
    await comfyPage.command.executeCommand(
      'Comfy.Canvas.ToggleSelectedNodes.Pin'
    )
    await expect.poll(() => nodeRef.isPinned()).toBe(false)
    await region.expectScreenshot('nodes-unpinned.png')
  })

  test(
    'Can bypass/unbypass nodes with keyboard shortcut',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.nodeOps.selectNodes(['CLIP Text Encode (Prompt)'])
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('CLIP Text Encode (Prompt)')
      )[0]

      const region = await screenshotRegion(
        comfyPage.page,
        await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
      )
      await comfyPage.canvas.press('Control+b')
      await expect.poll(() => nodeRef.isBypassed()).toBe(true)
      await region.expectScreenshot('nodes-bypassed.png')
      await comfyPage.canvas.press('Control+b')
      await expect.poll(() => nodeRef.isBypassed()).toBe(false)
      await region.expectScreenshot('nodes-unbypassed.png')
    }
  )
})

test.describe('Group Interaction', { tag: '@screenshot' }, () => {
  test('Can double click group title to edit', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('groups/single_group')
    await comfyPage.canvas.dblclick({
      position: {
        x: 50,
        y: 10
      },
      delay: 5
    })
    await comfyPage.page.keyboard.type('Hello World')
    await comfyPage.page.keyboard.press('Enter')
    await expectRegionScreenshot(
      comfyPage.page,
      [graphItems(comfyPage.page, 'all')],
      'group-title-edited.png'
    )
  })
})

test.describe('Canvas Interaction', { tag: '@screenshot' }, () => {
  test('Settings and input transform the rendered graph', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting(
      'Comfy.Canvas.NavigationMode',
      'standard'
    )
    const before = await comfyPage.canvasOps.snapshotNavigation()
    await comfyPage.page.mouse.move(400, 300)
    await comfyPage.page.keyboard.down('Control')
    await comfyPage.page.mouse.wheel(0, -120)
    await comfyPage.page.keyboard.up('Control')
    await comfyPage.canvasOps.expectNavigationTransform(before, {
      ratio: 1.1,
      anchor: [400, 300]
    })
    await expectElementScreenshot(comfyPage.canvas, 'legacy-wheel-zoom-in.png')

    await comfyPage.canvas.focus()
    await comfyPage.page.keyboard.down('Space')
    await comfyPage.canvasOps.dragAndDrop({ x: 50, y: 50 }, { x: 187, y: 133 })
    await comfyPage.page.keyboard.up('Space')
    await comfyPage.canvasOps.expectNavigationTransform(before, {
      ratio: 1.1,
      anchor: [400, 300],
      pan: [137, 83]
    })
  })

  test('Widgets recover after a low-quality zoom round trip', async ({
    comfyPage
  }) => {
    const before = await comfyPage.canvasOps.snapshotNavigation()
    const prompts = comfyPage.canvasOps.textareaWidgets
    await comfyPage.page.evaluate(() => {
      const { canvas } = window.app!
      canvas.ds.changeScale(0.25, [233, 177])
      canvas.setDirty(true, true)
    })
    await expect(prompts.first()).toBeHidden()
    await expect(prompts.last()).toBeHidden()

    await comfyPage.page.evaluate(() => {
      const { canvas } = window.app!
      canvas.ds.changeScale(1, [233, 177])
      canvas.ds.offset = [37, -23]
      canvas.setDirty(true, true)
    })
    await comfyPage.canvasOps.expectNavigationTransform(before, {
      pan: [37, -23]
    })
    await expect
      .poll(() => comfyPage.canvasOps.getNavigationWidgetHitTargets())
      .toEqual([
        { visible: true, leftClipped: false, hits: [true, true] },
        { visible: true, leftClipped: false, hits: [true, true] }
      ])
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
    await expect.poll(() => getCursorStyle()).toBe('default')
    await comfyPage.page.mouse.down()
    await expect.poll(() => getCursorStyle()).toBe('grabbing')
    // Move mouse should not alter cursor style.
    await comfyPage.page.mouse.move(10, 20)
    await expect.poll(() => getCursorStyle()).toBe('grabbing')
    await comfyPage.page.mouse.up()
    await expect.poll(() => getCursorStyle()).toBe('default')

    await comfyPage.page.keyboard.down('Space')
    await expect.poll(() => getCursorStyle()).toBe('grab')
    await comfyPage.page.mouse.down()
    await expect.poll(() => getCursorStyle()).toBe('grabbing')
    await comfyPage.page.mouse.up()
    await expect.poll(() => getCursorStyle()).toBe('grab')
    await comfyPage.page.keyboard.up('Space')
    await expect.poll(() => getCursorStyle()).toBe('default')
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
    await expect.poll(() => getCursorStyle()).toBe('default')

    // Click and hold
    await comfyPage.page.mouse.down()
    await expect.poll(() => getCursorStyle()).toBe('grabbing')

    // Press space while holding click
    await comfyPage.page.keyboard.down('Space')
    await expect.poll(() => getCursorStyle()).toBe('grabbing')

    // Release click while space is still down
    await comfyPage.page.mouse.up()
    await expect.poll(() => getCursorStyle()).toBe('grab')

    // Release space
    await comfyPage.page.keyboard.up('Space')
    await expect.poll(() => getCursorStyle()).toBe('default')

    // Move mouse - cursor should remain default
    await comfyPage.page.mouse.move(20, 20)
    await expect.poll(() => getCursorStyle()).toBe('default')
  })

  test('Can pan when dragging a link', async ({ comfyPage, comfyMouse }) => {
    const posSlot1 = DefaultGraphPositions.clipTextEncodeNode1InputSlot
    await comfyMouse.move(posSlot1)
    const posEmpty = DefaultGraphPositions.emptySpace
    await comfyMouse.drag(posEmpty)
    await expectRegionScreenshot(
      comfyPage.page,
      await clipLinkTargets(comfyPage, posEmpty),
      'dragging-link1.png'
    )

    await comfyPage.page.keyboard.down('Space')
    await comfyMouse.mouse.move(posEmpty.x + 100, posEmpty.y + 100)
    await expectElementScreenshot(
      comfyPage.canvas,
      'panning-when-dragging-link.png'
    )
    await comfyPage.page.keyboard.up('Space')
    await comfyMouse.move(posEmpty)
    await expectRegionScreenshot(
      comfyPage.page,
      await clipLinkTargets(comfyPage, posEmpty),
      'dragging-link2.png'
    )
    await comfyMouse.drop()
  })

  test('Rendering clears offscreen content and restores clipped widgets', async ({
    comfyPage
  }) => {
    const before = await comfyPage.canvasOps.snapshotNavigation()
    await comfyPage.canvasOps.setOffset([-600, -100])
    await comfyPage.canvasOps.expectNavigationTransform(before, {
      pan: [-600, -100]
    })
    await expect
      .poll(() => comfyPage.canvasOps.getNavigationWidgetHitTargets())
      .toEqual([
        { visible: true, leftClipped: true, hits: [true, true] },
        { visible: true, leftClipped: true, hits: [true, true] }
      ])
    await comfyPage.canvasOps.setOffset([-3200, -2500])
    const prompts = comfyPage.canvasOps.textareaWidgets
    await expect(prompts.first()).toBeHidden()
    await expect(prompts.last()).toBeHidden()
    await expectElementScreenshot(comfyPage.canvas, 'panned-far-away.png')
    await comfyPage.canvasOps.setOffset([-600, -100])
    await comfyPage.canvasOps.expectNavigationTransform(before, {
      pan: [-600, -100]
    })
    await expect
      .poll(() => comfyPage.canvasOps.getNavigationWidgetHitTargets())
      .toEqual([
        { visible: true, leftClipped: true, hits: [true, true] },
        { visible: true, leftClipped: true, hits: [true, true] }
      ])
  })

  test('@mobile Can pan with touch', async ({ comfyPage }) => {
    await comfyPage.canvasOps.setScale(0.75)
    await comfyPage.canvasOps.setOffset([-100, 0])
    const before = await comfyPage.canvasOps.snapshotNavigation()
    await comfyPage.canvasOps.panWithTouch(
      { x: 83, y: 137 },
      { x: 30, y: 50 },
      10
    )
    await comfyPage.canvasOps.expectNavigationTransform(before, {
      pan: [83, 137]
    })
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
    await comfyPage.keyboard.undo(null)
    await expect(textBox).toHaveValue('')
  })

  test('Undo attention edit', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.EditAttention.Delta', 0.05)
    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    await textBox.fill('1girl')
    await expect(textBox).toHaveValue('1girl')
    await textBox.selectText()
    await comfyPage.keyboard.moveUp(null)
    await expect(textBox).toHaveValue('(1girl:1.05)')
    await comfyPage.keyboard.undo(null)
    await expect(textBox).toHaveValue('1girl')
  })
})

test.describe('Load workflow', { tag: '@screenshot' }, () => {
  test('Can load workflow with string node id', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('nodes/string_node_id')
    await expectRegionScreenshot(
      comfyPage.page,
      [graphItems(comfyPage.page, 'all')],
      'string_node_id.png'
    )
  })

  test('Can load workflow with ("STRING",) input node', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('inputs/string_input')
    await expectRegionScreenshot(
      comfyPage.page,
      [graphItems(comfyPage.page, 'all')],
      'string_input.png'
    )
  })

  test('Creates initial workflow tab when persistence is disabled', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.Workflow.Persist', false)
    // oxlint-disable-next-line comfy/no-comfy-page-setup-call -- pre-existing call, tracked by evfail-23; not fixed in this pass
    await comfyPage.setup()

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => {
          return (window.app!.extensionManager as WorkspaceStore).workflow
            .openWorkflows.length
        })
      )
      .toBeGreaterThanOrEqual(1)
  })

  test('Restore workflow on reload (switch workflow)', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    const region = await screenshotRegion(comfyPage.page, [
      graphItems(comfyPage.page, 'all')
    ])
    await region.expectScreenshot('single_ksampler.png')
    // oxlint-disable-next-line comfy/no-comfy-page-setup-call -- pre-existing call, tracked by evfail-23; not fixed in this pass
    await comfyPage.setup({ clearStorage: false })
    await region.expectScreenshot('single_ksampler.png')
  })

  test('Restore workflow on reload (modify workflow)', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    const node = (await comfyPage.nodeOps.getFirstNodeRef())!
    const region = await screenshotRegion(comfyPage.page, [
      graphItems(comfyPage.page, 'all')
    ])
    const draftSaveStartedAt = Date.now()
    await node.click('collapse')
    await comfyPage.canvasOps.clickEmptySpace()
    await region.expectScreenshot('single_ksampler_modified.png')
    await comfyPage.workflow.waitForDraftIndexUpdatedSince(draftSaveStartedAt)
    // oxlint-disable-next-line comfy/no-comfy-page-setup-call -- pre-existing call, tracked by evfail-23; not fixed in this pass
    await comfyPage.setup({ clearStorage: false })
    await region.expectScreenshot('single_ksampler_modified.png')
  })

  const generateUniqueFilename = (extension = '') =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${extension}`

  test.describe('Restore all open workflows on reload', () => {
    test.describe.configure({ timeout: 45_000 })
    test.use({ initialSettings: { 'Comfy.UseNewMenu': 'Top' } })

    let workflowA: string
    let workflowB: string

    test.beforeEach(async ({ comfyPage }) => {
      workflowA = generateUniqueFilename()
      await comfyPage.menu.topbar.saveWorkflow(workflowA)
      workflowB = generateUniqueFilename()
      await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
      await comfyPage.menu.topbar.saveWorkflow(workflowB)

      // Wait for sessionStorage to persist the workflow paths before reloading
      // V2 persistence uses sessionStorage with client-scoped keys
      await comfyPage.page.waitForFunction(() => {
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i)
          if (key?.startsWith('Comfy.Workflow.OpenPaths:')) {
            return true
          }
        }
        return false
      })
      // oxlint-disable-next-line comfy/no-comfy-page-setup-call -- pre-existing call, tracked by evfail-23; not fixed in this pass
      await comfyPage.setup({ clearStorage: false })
    })

    test('Restores topbar workflow tabs after reload', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.WorkflowTabsPosition',
        'Topbar'
      )

      await expect
        .poll(() => comfyPage.menu.topbar.getTabNames())
        .toEqual(expect.arrayContaining([workflowA, workflowB]))

      await expect
        .poll(async () => {
          const tabs = await comfyPage.menu.topbar.getTabNames()
          return (
            tabs.indexOf(workflowA) < tabs.indexOf(workflowB) &&
            tabs.indexOf(workflowA) >= 0
          )
        })
        .toBe(true)

      await expect(comfyPage.menu.topbar.getActiveTab()).toContainText(
        workflowB
      )
    })

    test('Restores sidebar workflows after reload', async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.WorkflowTabsPosition',
        'Sidebar'
      )
      await comfyPage.menu.workflowsTab.open()
      await expect
        .poll(() => comfyPage.menu.workflowsTab.getOpenedWorkflowNames())
        .toEqual(expect.arrayContaining([workflowA, workflowB]))
      await expect
        .poll(async () => {
          const ws = await comfyPage.menu.workflowsTab.getOpenedWorkflowNames()
          return ws.indexOf(workflowA) < ws.indexOf(workflowB)
        })
        .toBe(true)
      await expect(comfyPage.menu.workflowsTab.activeWorkflowLabel).toHaveText(
        workflowB
      )
    })
  })

  test.describe('Restore workflow tabs after browser restart', () => {
    test.describe.configure({ timeout: 45_000 })
    test.use({ initialSettings: { 'Comfy.UseNewMenu': 'Top' } })

    let workflowA: string
    let workflowB: string

    test.beforeEach(async ({ comfyPage }) => {
      workflowA = generateUniqueFilename()
      await comfyPage.menu.topbar.saveWorkflow(workflowA)
      workflowB = generateUniqueFilename()
      await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
      await comfyPage.menu.topbar.saveWorkflow(workflowB)

      // Wait for localStorage fallback pointers to be written
      await comfyPage.page.waitForFunction(() => {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i)
          if (key?.startsWith('Comfy.Workflow.LastOpenPaths:')) {
            return true
          }
        }
        return false
      })

      // Simulate browser restart: clear sessionStorage (lost on close)
      // but keep localStorage (survives browser restart)
      await comfyPage.page.evaluate(() => {
        sessionStorage.clear()
      })
      // oxlint-disable-next-line comfy/no-comfy-page-setup-call -- pre-existing call, tracked by evfail-23; not fixed in this pass
      await comfyPage.setup({ clearStorage: false })
    })

    test('Restores topbar workflow tabs after browser restart', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.WorkflowTabsPosition',
        'Topbar'
      )
      // Wait for both restored tabs to render (localStorage fallback is async)
      await expect(
        comfyPage.page.locator('.workflow-tabs .workflow-label', {
          hasText: workflowA
        })
      ).toBeVisible()

      await expect
        .poll(async () => {
          const tabs = await comfyPage.menu.topbar.getTabNames()
          return (
            tabs.includes(workflowA) &&
            tabs.includes(workflowB) &&
            tabs.indexOf(workflowA) < tabs.indexOf(workflowB)
          )
        })
        .toBe(true)

      await expect(comfyPage.menu.topbar.getActiveTab()).toContainText(
        workflowB
      )
    })

    test('Restores sidebar workflows after browser restart', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.WorkflowTabsPosition',
        'Sidebar'
      )
      await comfyPage.menu.workflowsTab.open()
      await expect
        .poll(() => comfyPage.menu.workflowsTab.getOpenedWorkflowNames())
        .toEqual(expect.arrayContaining([workflowA, workflowB]))
      await expect
        .poll(async () => {
          const ws = await comfyPage.menu.workflowsTab.getOpenedWorkflowNames()
          return ws.indexOf(workflowA) < ws.indexOf(workflowB)
        })
        .toBe(true)
      await expect(comfyPage.menu.workflowsTab.activeWorkflowLabel).toHaveText(
        workflowB
      )
    })
  })

  test('Auto fit view after loading workflow', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(
      'Comfy.EnableWorkflowViewRestore',
      false
    )
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await expectElementScreenshot(comfyPage.canvas, 'single_ksampler_fit.png')
  })
})

test.describe('Load duplicate workflow', () => {
  test.use({ initialSettings: { 'Comfy.UseNewMenu': 'Top' } })

  test('A workflow can be loaded multiple times in a row', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await comfyPage.menu.workflowsTab.open()
    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await comfyPage.expectNodeCount(1)
  })
})

test.describe('Viewport settings', () => {
  test.use({
    initialSettings: {
      'Comfy.UseNewMenu': 'Top'
    }
  })

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({})
  })

  test('Keeps viewport settings when changing tabs', async ({
    comfyPage,
    comfyMouse
  }) => {
    const getViewport = async () => ({
      scale: await comfyPage.canvasOps.getScale(),
      offset: await comfyPage.canvasOps.getOffset()
    })

    const changeTab = async (workflowName: string) => {
      await comfyPage.menu.topbar.getWorkflowTab(workflowName).click()
      await expect
        .poll(() => comfyPage.workflow.getActiveWorkflowPath())
        .toBe(`workflows/${workflowName}.json`)
      await comfyPage.canvasOps.waitForViewToSettle()
      await comfyMouse.move(DefaultGraphPositions.emptySpace)

      await expect(
        comfyPage.page.locator('.workflow-popover-fade')
      ).toHaveCount(0)
    }

    await test.step('Save two workflow tabs', async () => {
      await comfyPage.settings.setSetting('Comfy.Graph.CanvasMenu', true)
      await comfyPage.page
        .getByTestId(TestIds.canvas.toggleMinimapButton)
        .click()
      await comfyPage.settings.setSetting('Comfy.Graph.CanvasMenu', false)

      await comfyPage.menu.topbar.saveWorkflow('Workflow A')
      await comfyPage.nextFrame()
      await comfyPage.menu.topbar.saveWorkflowAs('Workflow B')
      await comfyPage.nextFrame()
    })

    const { viewportA, viewportB } =
      await test.step('Give each workflow a distinct viewport', async () => {
        await changeTab('Workflow A')
        const viewportA = await getViewport()

        await changeTab('Workflow B')
        await comfyMouse.wheel(0, 60)
        await expect.poll(getViewport).not.toEqual(viewportA)
        await comfyPage.canvasOps.waitForViewToSettle()

        const viewportB = await getViewport()
        expect(viewportB).not.toEqual(viewportA)
        return { viewportA, viewportB }
      })

    await test.step('Restore Workflow A viewport', async () => {
      await changeTab('Workflow A')
      await expect.poll(getViewport).toEqual(viewportA)
    })

    await test.step('Restore Workflow B viewport', async () => {
      await changeTab('Workflow B')
      await expect.poll(getViewport).toEqual(viewportB)
    })
  })
})

test.describe('Canvas Navigation', { tag: '@screenshot' }, () => {
  test.use({
    initialSettings: {
      'Comfy.UseNewMenu': 'Disabled',
      'Comfy.Canvas.NavigationMode': 'standard'
    }
  })

  test('Left-click drag in empty area should select nodes', async ({
    comfyPage
  }) => {
    const clipNodes =
      await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
    const clipNode1Pos = await clipNodes[0].getPosition()
    const clipNode2Pos = await clipNodes[1].getPosition()
    const offset = 64
    const dragFrom = {
      x: Math.min(clipNode1Pos.x, clipNode2Pos.x) - offset,
      y: Math.min(clipNode1Pos.y, clipNode2Pos.y) - offset
    }
    const dragTo = {
      x: Math.max(clipNode1Pos.x, clipNode2Pos.x) + offset,
      y: Math.max(clipNode1Pos.y, clipNode2Pos.y) + offset
    }

    await comfyPage.canvasOps.dragAndDrop(dragFrom, dragTo)

    await expect
      .poll(() => comfyPage.nodeOps.getSelectedGraphNodesCount())
      .toBe(clipNodes.length)
    await expectRegionScreenshot(
      comfyPage.page,
      [...clipNodes, dragFrom, dragTo],
      'standard-left-drag-select.png'
    )
  })
})
