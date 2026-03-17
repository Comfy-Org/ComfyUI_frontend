import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import {
  getPromotedWidgetSnapshot,
  getPromotedWidgets
} from '../helpers/promotedWidgets'

test.describe('Subgraph Lifecycle', { tag: ['@subgraph', '@widget'] }, () => {
  test('hydrates legacy proxyWidgets deterministically across reload', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-nested-duplicate-ids'
    )
    await comfyPage.nextFrame()

    const firstSnapshot = await getPromotedWidgetSnapshot(comfyPage, '5')
    expect(firstSnapshot.proxyWidgets.length).toBeGreaterThan(0)
    expect(
      firstSnapshot.proxyWidgets.every(([nodeId]) => nodeId !== '-1')
    ).toBe(true)

    await comfyPage.page.reload()
    await comfyPage.setup()
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-nested-duplicate-ids'
    )
    await comfyPage.nextFrame()

    const secondSnapshot = await getPromotedWidgetSnapshot(comfyPage, '5')
    expect(secondSnapshot.proxyWidgets).toEqual(firstSnapshot.proxyWidgets)
    expect(secondSnapshot.widgetNames).toEqual(firstSnapshot.widgetNames)
  })

  test('promoted view falls back to disconnected placeholder after source widget removal', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-promoted-text-widget'
    )
    await comfyPage.nextFrame()

    const projection = await comfyPage.page.evaluate(() => {
      const graph = window.app!.graph!
      const hostNode = graph.getNodeById('11')
      if (
        !hostNode ||
        typeof hostNode.isSubgraphNode !== 'function' ||
        !hostNode.isSubgraphNode()
      )
        throw new Error('Expected host subgraph node 11')

      const beforeType = hostNode.widgets?.[0]?.type
      const proxyWidgets = Array.isArray(hostNode.properties?.proxyWidgets)
        ? hostNode.properties.proxyWidgets.filter(
            (entry): entry is [string, string] =>
              Array.isArray(entry) &&
              entry.length === 2 &&
              typeof entry[0] === 'string' &&
              typeof entry[1] === 'string'
          )
        : []
      const firstPromotion = proxyWidgets[0]
      if (!firstPromotion)
        throw new Error('Expected at least one promoted widget entry')

      const [sourceNodeId, sourceWidgetName] = firstPromotion
      const subgraph = graph.subgraphs.get(hostNode.type)
      const sourceNode = subgraph?.getNodeById(Number(sourceNodeId))
      if (!sourceNode?.widgets)
        throw new Error('Expected promoted source node widget list')

      sourceNode.widgets = sourceNode.widgets.filter(
        (widget) => widget.name !== sourceWidgetName
      )

      return {
        beforeType,
        afterType: hostNode.widgets?.[0]?.type
      }
    })

    expect(projection.beforeType).toBe('customtext')
    expect(projection.afterType).toBe('button')
  })

  test('unpacking one preview host keeps remaining pseudo-preview promotions resolvable', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-multiple-promoted-previews'
    )
    await comfyPage.nextFrame()

    const beforeNode8 = await getPromotedWidgets(comfyPage, '8')
    expect(beforeNode8).toEqual([['6', '$$canvas-image-preview']])

    const cleanupResult = await comfyPage.page.evaluate(() => {
      const graph = window.app!.graph!
      const invalidPseudoEntries = () => {
        const invalid: string[] = []
        for (const node of graph.nodes) {
          if (
            typeof node.isSubgraphNode !== 'function' ||
            !node.isSubgraphNode()
          )
            continue

          const subgraph = graph.subgraphs.get(node.type)
          const proxyWidgets = Array.isArray(node.properties?.proxyWidgets)
            ? node.properties.proxyWidgets.filter(
                (entry): entry is [string, string] =>
                  Array.isArray(entry) &&
                  entry.length === 2 &&
                  typeof entry[0] === 'string' &&
                  typeof entry[1] === 'string'
              )
            : []
          for (const entry of proxyWidgets) {
            if (entry[1] !== '$$canvas-image-preview') continue

            const sourceNodeId = Number(entry[0])
            const sourceNode = subgraph?.getNodeById(sourceNodeId)
            if (!sourceNode) invalid.push(`${node.id}:${entry[0]}`)
          }
        }
        return invalid
      }

      const before = invalidPseudoEntries()
      const hostNode = graph.getNodeById('7')
      if (
        !hostNode ||
        typeof hostNode.isSubgraphNode !== 'function' ||
        !hostNode.isSubgraphNode()
      )
        throw new Error('Expected preview host subgraph node 7')

      ;(
        graph as unknown as { unpackSubgraph: (node: unknown) => void }
      ).unpackSubgraph(hostNode)

      return {
        before,
        after: invalidPseudoEntries(),
        hasNode7: Boolean(graph.getNodeById('7')),
        hasNode8: Boolean(graph.getNodeById('8'))
      }
    })

    expect(cleanupResult.before).toEqual([])
    expect(cleanupResult.after).toEqual([])
    expect(cleanupResult.hasNode7).toBe(false)
    expect(cleanupResult.hasNode8).toBe(true)

    const afterNode8 = await getPromotedWidgets(comfyPage, '8')
    expect(afterNode8).toEqual([['6', '$$canvas-image-preview']])
  })
})
