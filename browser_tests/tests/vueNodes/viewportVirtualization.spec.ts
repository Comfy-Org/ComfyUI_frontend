import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { assertNodeSlotsWithinBounds } from '@e2e/fixtures/utils/slotBoundsUtil'

test.describe('Viewport node virtualization', { tag: ['@canvas'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.settings.setSetting(
      'Comfy.VueNodes.ViewportVirtualization',
      true
    )
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('mounts nearby nodes, swaps them while panning, and toggles immediately', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')
    await comfyPage.canvasOps.setScale(1)
    await (await comfyPage.nodeOps.getNodeRefById(1)).centerOnNode()

    const graphNodeCount = await comfyPage.nodeOps.getGraphNodesCount()
    await expect
      .poll(() => comfyPage.vueNodes.getNodeCount())
      .toBeGreaterThan(0)
    await expect
      .poll(() => comfyPage.vueNodes.getNodeCount())
      .toBeLessThan(graphNodeCount)

    const initialNodeIds = await comfyPage.vueNodes.getNodeIds()
    const canvasBox = await comfyPage.canvas.boundingBox()
    if (!canvasBox) throw new Error('Canvas bounding box not available')

    const centerX = canvasBox.x + canvasBox.width / 2
    const centerY = canvasBox.y + canvasBox.height / 2
    const panStep = canvasBox.height / 3
    for (let step = 0; step < 3; step++) {
      await comfyPage.page.mouse.move(centerX, centerY)
      await comfyPage.page.mouse.down({ button: 'middle' })
      await comfyPage.page.mouse.move(centerX, centerY - panStep, { steps: 20 })
      await comfyPage.page.mouse.up({ button: 'middle' })
    }

    await expect
      .poll(async () => {
        const currentNodeIds = await comfyPage.vueNodes.getNodeIds()
        const hasMountedNode = currentNodeIds.some(
          (id) => !initialNodeIds.includes(id)
        )
        const hasUnmountedNode = initialNodeIds.some(
          (id) => !currentNodeIds.includes(id)
        )
        return hasMountedNode && hasUnmountedNode
      })
      .toBe(true)

    await comfyPage.settings.setSetting(
      'Comfy.VueNodes.ViewportVirtualization',
      false
    )
    await expect
      .poll(() => comfyPage.vueNodes.getNodeCount(), { timeout: 15_000 })
      .toBe(graphNodeCount)

    await comfyPage.settings.setSetting(
      'Comfy.VueNodes.ViewportVirtualization',
      true
    )
    await expect
      .poll(() => comfyPage.vueNodes.getNodeCount())
      .toBeLessThan(graphNodeCount)
  })

  test('keeps a focused widget mounted while its node is offscreen', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')
    await comfyPage.canvasOps.setScale(1)

    const editedNode = await comfyPage.nodeOps.getNodeRefById(2)
    await editedNode.centerOnNode()
    const textarea = comfyPage.vueNodes.getNodeLocator('2').getByRole('textbox')
    await textarea.fill('virtualized edit')
    await expect(textarea).toBeFocused()

    await (await comfyPage.nodeOps.getNodeRefById(241)).centerOnNode()

    await expect(comfyPage.vueNodes.getNodeLocator('2')).toBeAttached()
    await expect(textarea).toBeFocused()
    await expect(textarea).toHaveValue('virtualized edit')

    await comfyPage.canvas.focus()
    await expect(comfyPage.vueNodes.getNodeLocator('2')).toHaveCount(0)
  })

  test('updates a mounted node immediately when it collapses', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')
    await comfyPage.canvasOps.setScale(1)

    const node = await comfyPage.nodeOps.getNodeRefById(2)
    await node.centerOnNode()
    const vueNode = comfyPage.vueNodes.getNodeLocator('2')
    await expect(vueNode).not.toHaveAttribute('data-collapsed', 'true')

    await vueNode.getByTestId('node-collapse-button').click()

    await expect(vueNode).toHaveAttribute('data-collapsed', 'true')

    await vueNode.getByTestId('node-collapse-button').click()

    await expect(vueNode).not.toHaveAttribute('data-collapsed', 'true')
  })

  test('preserves links and output updates while a node is offscreen', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('execution/partial_execution')
    await comfyPage.canvasOps.setScale(1)

    const outputNode = await comfyPage.nodeOps.getNodeRefById(1)
    await outputNode.centerOnNode()
    await outputNode.dragBy({ x: 3_000, y: 0 })
    await comfyPage.canvas.focus()
    await (await comfyPage.nodeOps.getNodeRefById(3)).centerOnNode()
    await expect(comfyPage.vueNodes.getNodeLocator('1')).toHaveCount(0)

    await comfyPage.command.executeCommand('Comfy.QueuePrompt')
    await expect
      .poll(async () => (await outputNode.getWidget(0)).getValue(), {
        timeout: 10_000
      })
      .toBe('foo')

    await outputNode.centerOnNode()
    await expect(
      comfyPage.vueNodes
        .getNodeLocator('1')
        .getByRole('textbox', { name: 'preview_text' })
    ).toHaveValue('foo')
    await assertNodeSlotsWithinBounds(comfyPage.page, '1')
  })

  test('renders collapsed nodes after entering a subgraph', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-collapsed-node'
    )
    await comfyPage.vueNodes.enterSubgraph('2')
    await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

    await comfyPage.canvasOps.setScale(1)
    await (await comfyPage.nodeOps.getNodeRefById(1)).centerOnNode()

    await expect(comfyPage.vueNodes.getNodeLocator('1')).toHaveAttribute(
      'data-collapsed',
      'true'
    )
    await assertNodeSlotsWithinBounds(comfyPage.page, '1')
  })
})
