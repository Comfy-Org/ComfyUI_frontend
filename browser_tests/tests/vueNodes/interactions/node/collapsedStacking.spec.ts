import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
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
      x: Math.max(collapsedBox.x, expandedBox.x) + 20,
      y: Math.max(collapsedBox.y, expandedBox.y) + 12
    }
    const exposedCollapsed = {
      x: collapsedBox.x + 10,
      y: collapsedBox.y + 12
    }
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
    await comfyPage.page.mouse.click(overlap.x, overlap.y)
    await expect
      .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
      .toEqual([expandedId])
  })
})
