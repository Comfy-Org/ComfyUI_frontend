import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  getPromotedWidgetNames,
  getPromotedWidgets
} from '@e2e/fixtures/utils/promotedWidgets'

async function getSubgraphNodeIds(comfyPage: ComfyPage): Promise<string[]> {
  return comfyPage.page.evaluate(() => {
    const graph = window.app!.canvas.graph!
    return graph.nodes
      .filter(
        (n) => typeof n.isSubgraphNode === 'function' && n.isSubgraphNode()
      )
      .map((n) => String(n.id))
  })
}

test.describe('Subgraph Copy-Paste', { tag: ['@subgraph', '@widget'] }, () => {
  test('Copy-paste SubgraphNode preserves promoted widgets', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-promoted-text-widget'
    )
    await comfyPage.nextFrame()

    const originalNode = await comfyPage.nodeOps.getNodeRefById('11')
    const originalPromoted = await getPromotedWidgetNames(comfyPage, '11')
    expect(originalPromoted).toContain('text')

    // Select the subgraph node
    await originalNode.click('title')
    await comfyPage.nextFrame()

    // Copy via Ctrl+C, then paste via Ctrl+V
    await comfyPage.clipboard.copy()
    await comfyPage.clipboard.paste()
    await comfyPage.nextFrame()

    // Should now have 2 subgraph nodes
    const nodeIds = await getSubgraphNodeIds(comfyPage)
    expect(nodeIds).toHaveLength(2)

    // Both should have promoted widgets with 'text'
    for (const nodeId of nodeIds) {
      const promotedWidgets = await getPromotedWidgets(comfyPage, nodeId)
      expect(promotedWidgets.length).toBeGreaterThan(0)
      expect(
        promotedWidgets.some(([, widgetName]) => widgetName === 'text')
      ).toBe(true)
    }
  })

  test('Copy-paste SubgraphNode preserves promoted widget values in serialized data', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-promoted-text-widget'
    )
    await comfyPage.nextFrame()

    const originalNode = await comfyPage.nodeOps.getNodeRefById('11')
    const originalWidgetValues = await comfyPage.page.evaluate(() => {
      return window
        .app!.canvas.graph!.nodes.find((node) => String(node.id) === '11')
        ?.serialize().widgets_values
    })
    await originalNode.click('title')
    await comfyPage.nextFrame()

    await comfyPage.clipboard.copy()
    await comfyPage.clipboard.paste()
    await comfyPage.nextFrame()

    const nodeIds = await getSubgraphNodeIds(comfyPage)
    const pastedId = nodeIds.find((id) => id !== '11')
    expect(pastedId).toBeDefined()

    const pastedWidgetValues = await comfyPage.page.evaluate((id) => {
      return window
        .app!.canvas.graph!.nodes.find((node) => String(node.id) === id)
        ?.serialize().widgets_values
    }, pastedId!)

    expect(pastedWidgetValues).toEqual(originalWidgetValues)
  })

  test('Pasted SubgraphNode interior widget values survive round-trip', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-promoted-text-widget'
    )
    await comfyPage.nextFrame()

    const testContent = 'copy-paste-round-trip-test'

    // Set a value on the promoted textarea
    const textarea = comfyPage.page.getByTestId(
      TestIds.widgets.domWidgetTextarea
    )
    await textarea.first().fill(testContent)
    await comfyPage.nextFrame()

    // Select and copy the SubgraphNode
    const originalNode = await comfyPage.nodeOps.getNodeRefById('11')
    await originalNode.click('title')
    await comfyPage.nextFrame()

    await comfyPage.clipboard.copy()
    await comfyPage.clipboard.paste()
    await comfyPage.nextFrame()

    // Serialize the whole graph and reload to test full round-trip
    const serialized = await comfyPage.page.evaluate(() => {
      return window.app!.graph!.serialize()
    })

    await comfyPage.page.evaluate(
      (workflow) => {
        return window.app!.loadGraphData(workflow)
      },
      serialized as Parameters<typeof comfyPage.page.evaluate>[1]
    )
    await comfyPage.nextFrame()

    // Both subgraph nodes should still have promoted widgets
    const nodeIds = await getSubgraphNodeIds(comfyPage)
    expect(nodeIds.length).toBeGreaterThanOrEqual(2)

    for (const nodeId of nodeIds) {
      const promoted = await getPromotedWidgetNames(comfyPage, nodeId)
      expect(promoted).toContain('text')
    }
  })
})
