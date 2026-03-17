import { expect } from '@playwright/test'

import type { ComfyPage } from '../fixtures/ComfyPage'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { TestIds } from '../fixtures/selectors'
import {
  getPromotedWidgetNames,
  getPromotedWidgets
} from '../helpers/promotedWidgets'

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

  test('Copy-paste SubgraphNode preserves proxyWidgets in serialized data', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-promoted-text-widget'
    )
    await comfyPage.nextFrame()

    const originalNode = await comfyPage.nodeOps.getNodeRefById('11')
    await originalNode.click('title')
    await comfyPage.nextFrame()

    await comfyPage.clipboard.copy()
    await comfyPage.clipboard.paste()
    await comfyPage.nextFrame()

    // The pasted node should have proxyWidgets in its properties
    const nodeIds = await getSubgraphNodeIds(comfyPage)
    const pastedId = nodeIds.find((id) => id !== '11')
    expect(pastedId).toBeDefined()

    const pastedProxyWidgets = await comfyPage.page.evaluate((id) => {
      const node = window.app!.canvas.graph!.getNodeById(id)
      const pw = node?.properties?.proxyWidgets
      if (!Array.isArray(pw)) return []
      return pw as [string, string][]
    }, pastedId!)

    expect(pastedProxyWidgets.length).toBeGreaterThan(0)

    // The proxyWidgets should reference the 'text' widget
    const hasTextWidget = pastedProxyWidgets.some(
      ([, widgetName]) => widgetName === 'text'
    )
    expect(hasTextWidget).toBe(true)
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
