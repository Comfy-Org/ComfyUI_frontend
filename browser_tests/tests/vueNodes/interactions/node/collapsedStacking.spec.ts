import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { findEmptyCanvasPoint } from '@e2e/fixtures/utils/findEmptyCanvasPoint'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import { toNodeId } from '@/types/nodeId'

test.describe('Collapsed Vue node stacking', { tag: '@vue-nodes' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    await comfyPage.workflow.loadWorkflow('vueNodes/collapsed-stacking')
    await fitToViewInstant(comfyPage)
  })

  test('updates pointer hit order for selection and collapse state', async ({
    comfyPage
  }) => {
    const collapsed =
      await comfyPage.vueNodes.getFixtureByTitle('CLIP Text Encode')
    const expanded = await comfyPage.vueNodes.getFixtureByTitle('VAE Decode')
    const collapsedId = toNodeId(2)
    const expandedId = toNodeId(1)
    const collapsedBox = await collapsed.boundingBox()
    const expandedBox = await expanded.boundingBox()
    if (!collapsedBox || !expandedBox) throw new Error('Nodes are not visible')

    const overlap = {
      x: Math.max(collapsedBox.x, expandedBox.x) + 100,
      y: Math.max(collapsedBox.y, expandedBox.y) + 12
    }
    const exposedCollapsed = {
      x: collapsedBox.x + 35,
      y: collapsedBox.y + collapsedBox.height - 2
    }
    expect(
      collapsedBox.x + collapsedBox.width - overlap.x,
      'Collapsed node must extend beyond the overlap point horizontally'
    ).toBeGreaterThanOrEqual(1)
    expect(
      collapsedBox.y + collapsedBox.height - overlap.y,
      'Collapsed node must extend beyond the overlap point vertically'
    ).toBeGreaterThanOrEqual(1)
    await comfyPage.page.mouse.click(overlap.x, overlap.y)
    await expect
      .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
      .toEqual([expandedId])

    await expanded.header.click({ modifiers: ['Control'] })
    await expect.poll(() => comfyPage.nodeOps.getSelectedNodeIds()).toEqual([])
    await comfyPage.page.mouse.click(exposedCollapsed.x, exposedCollapsed.y)
    await expect
      .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
      .toEqual([collapsedId])

    await comfyPage.page.mouse.click(overlap.x, overlap.y)
    await expect
      .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
      .toEqual([collapsedId])

    await collapsed.header.click({ modifiers: ['Control'] })
    await expect.poll(() => comfyPage.nodeOps.getSelectedNodeIds()).toEqual([])
    await comfyPage.vueNodes.expectPaintsAbove('VAE Decode', 'CLIP Text Encode')
    await comfyPage.page.mouse.click(overlap.x, overlap.y)
    await expect
      .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
      .toEqual([expandedId])

    await expanded.header.click({ modifiers: ['Control'] })
    await expect.poll(() => comfyPage.nodeOps.getSelectedNodeIds()).toEqual([])
    await comfyPage.page.mouse.click(exposedCollapsed.x, exposedCollapsed.y)
    await expect
      .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
      .toEqual([collapsedId])
    await comfyPage.command.executeCommand(
      'Comfy.Canvas.ToggleSelectedNodes.Collapse'
    )
    await expect(collapsed.root).not.toHaveAttribute('data-collapsed', 'true')
    await comfyPage.page.mouse.click(overlap.x, overlap.y)
    await expect
      .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
      .toEqual([collapsedId])

    await comfyPage.command.executeCommand(
      'Comfy.Canvas.ToggleSelectedNodes.Collapse'
    )
    await expect(collapsed.root).toHaveAttribute('data-collapsed', 'true')
    await collapsed.header.click({ modifiers: ['Control'] })
    await expect.poll(() => comfyPage.nodeOps.getSelectedNodeIds()).toEqual([])
    await comfyPage.vueNodes.expectPaintsAbove('VAE Decode', 'CLIP Text Encode')
    await comfyPage.page.mouse.click(overlap.x, overlap.y)
    await expect
      .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
      .toEqual([expandedId])
  })

  test('keeps an unselected collapsed node as the drag owner after promotion', async ({
    comfyPage
  }) => {
    const collapsed =
      await comfyPage.vueNodes.getFixtureByTitle('CLIP Text Encode')
    const collapsedNode = await comfyPage.nodeOps.getNodeRefById('2')
    const expandedNode = await comfyPage.nodeOps.getNodeRefById('1')
    const collapsedBefore = await collapsedNode.getPosition()
    const expandedBefore = await expandedNode.getPosition()
    const collapsedBox = await collapsed.boundingBox()
    if (!collapsedBox) throw new Error('Collapsed node is not visible')

    await comfyPage.vueNodes.clearSelection()
    await expect.poll(() => comfyPage.nodeOps.getSelectedNodeIds()).toEqual([])

    const start = {
      x: collapsedBox.x + 10,
      y: collapsedBox.y + collapsedBox.height / 2
    }
    const emptyCanvasPoint = await findEmptyCanvasPoint(
      comfyPage.canvas,
      'bottom-right'
    )

    await comfyPage.page.mouse.move(start.x, start.y)
    await comfyPage.page.mouse.down()
    try {
      await comfyPage.page.mouse.move(start.x + 8, start.y + 8)
      await expect
        .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
        .toEqual([toNodeId(2)])
      await comfyPage.page.mouse.move(emptyCanvasPoint.x, emptyCanvasPoint.y)
    } finally {
      await comfyPage.page.mouse.up()
    }
    await comfyPage.nextFrame()

    const collapsedAfter = await collapsedNode.getPosition()
    const expandedAfter = await expandedNode.getPosition()
    expect(collapsedAfter).not.toEqual(collapsedBefore)
    expect(expandedAfter).toEqual(expandedBefore)

    await comfyPage.page.mouse.move(
      emptyCanvasPoint.x - 30,
      emptyCanvasPoint.y - 30
    )
    await comfyPage.nextFrame()

    expect(await collapsedNode.getPosition()).toEqual(collapsedAfter)
    expect(await expandedNode.getPosition()).toEqual(expandedAfter)
  })
})
