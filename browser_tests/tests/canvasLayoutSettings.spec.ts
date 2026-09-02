import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Size } from '@e2e/fixtures/types'

const expectedGroupSize = (
  nodeBounds: Size,
  padding: number,
  titleHeight: number
): Size => ({
  width: nodeBounds.width + padding * 2,
  // Group height adds one title row above the contained node bounds (which
  // themselves already include the node's own title), independent of padding.
  height: nodeBounds.height + padding * 2 + titleHeight
})

test.describe('Canvas layout settings', { tag: '@canvas' }, () => {
  test.describe('Comfy.SnapToGrid.GridSize', () => {
    const DRAG_DELTA = { x: 550, y: 330 } as const

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.clearGraph()
    })

    const createNode = async (comfyPage: ComfyPage) => {
      const note = await comfyPage.nodeOps.addNode('Note', undefined, {
        x: 0,
        y: 0
      })
      await note.centerOnNode()
      return note
    }

    test('shift+drag rounds final node position to multiples of grid size', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.SnapToGrid.GridSize', 100)
      const note = await createNode(comfyPage)

      await note.dragBy(DRAG_DELTA, { modifiers: ['Shift'] })

      // raw final world pos = (550, 330); rounded to nearest 100 = (600, 300)
      const after = await note.getProperty<[number, number]>('pos')
      expect(after[0]).toBe(600)
      expect(after[1]).toBe(300)
    })

    test('grid size determines the snap multiple', async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.SnapToGrid.GridSize', 50)
      const note = await createNode(comfyPage)

      await note.dragBy(DRAG_DELTA, { modifiers: ['Shift'] })

      // raw final world pos = (550, 330); rounded to nearest 50 = (550, 350)
      const after = await note.getProperty<[number, number]>('pos')
      expect(after[0]).toBe(550)
      expect(after[1]).toBe(350)
    })

    test('drag without shift bypasses snap regardless of grid size', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.SnapToGrid.GridSize', 100)
      const note = await createNode(comfyPage)
      const before = await note.getProperty<[number, number]>('pos')

      await note.dragBy(DRAG_DELTA)

      const after = await note.getProperty<[number, number]>('pos')
      expect(after[0]).toBe(before[0] + DRAG_DELTA.x)
      expect(after[1]).toBe(before[1] + DRAG_DELTA.y)
    })
  })

  test.describe('Comfy.GroupSelectedNodes.Padding', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    })

    const groupAroundAllNodesWithPadding = async (
      comfyPage: ComfyPage,
      padding: number
    ): Promise<Size> => {
      await comfyPage.settings.setSetting(
        'Comfy.GroupSelectedNodes.Padding',
        padding
      )
      await comfyPage.command.executeCommand('Comfy.Canvas.SelectAll')
      await comfyPage.command.executeCommand('Comfy.Graph.GroupSelectedNodes')
      return comfyPage.page.evaluate(() => {
        const group = window.app!.graph.groups[0]
        return { width: group.size[0], height: group.size[1] }
      })
    }

    test('padding=0 makes the group exactly enclose the selection', async ({
      comfyPage
    }) => {
      const ksampler = (
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      )[0]
      const nodeBounds = await ksampler.getBounding()
      const titleHeight = await comfyPage.canvasOps.getNodeTitleHeight()

      const group = await groupAroundAllNodesWithPadding(comfyPage, 0)

      expect(group).toEqual(expectedGroupSize(nodeBounds, 0, titleHeight))
    })

    test('padding=50 grows the group by 100 around the selection', async ({
      comfyPage
    }) => {
      const ksampler = (
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      )[0]
      const nodeBounds = await ksampler.getBounding()
      const titleHeight = await comfyPage.canvasOps.getNodeTitleHeight()

      const group = await groupAroundAllNodesWithPadding(comfyPage, 50)

      expect(group).toEqual(expectedGroupSize(nodeBounds, 50, titleHeight))
    })
  })

  test.describe('LiteGraph.ContextMenu.Scaling', () => {
    const ZOOM_SCALE = 2
    const litegraphContextMenu = (comfyPage: ComfyPage) =>
      comfyPage.page.locator('.litecontextmenu')

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
      await comfyPage.canvasOps.setScale(ZOOM_SCALE)
    })

    const openComboMenu = async (comfyPage: ComfyPage) => {
      const loadImage = (
        await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
      )[0]
      const fileCombo = await loadImage.getWidget(0)
      await fileCombo.click()
    }

    test('combo widget popup is scaled when setting is enabled', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('LiteGraph.ContextMenu.Scaling', true)

      await openComboMenu(comfyPage)

      const menu = litegraphContextMenu(comfyPage)
      await expect(menu).toBeVisible()
      await expect(menu).toHaveCSS(
        'transform',
        `matrix(${ZOOM_SCALE}, 0, 0, ${ZOOM_SCALE}, 0, 0)`
      )
    })

    test('combo widget popup is not scaled when setting is disabled', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'LiteGraph.ContextMenu.Scaling',
        false
      )

      await openComboMenu(comfyPage)

      const menu = litegraphContextMenu(comfyPage)
      await expect(menu).toBeVisible()
      await expect(menu).toHaveCSS('transform', 'none')
    })
  })
})
