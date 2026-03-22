import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

const WORKFLOW = 'subgraphs/nested-subgraph-stale-proxy-widgets'

/**
 * Regression test for nested subgraph packing leaving stale proxyWidgets
 * on the outer SubgraphNode.
 *
 * When two CLIPTextEncode nodes (ids 6, 7) inside the outer subgraph are
 * packed into a nested subgraph (node 11), the outer SubgraphNode (id 10)
 * must drop the now-stale ["7","text"] and ["6","text"] proxy entries.
 * Only ["3","seed"] (KSampler) should remain.
 *
 * Stale entries render as "Disconnected" placeholder widgets (type "button").
 *
 * See: https://github.com/Comfy-Org/ComfyUI_frontend/pull/10390
 */
test.describe(
  'Nested subgraph stale proxyWidgets',
  { tag: ['@subgraph', '@widget'] },
  () => {
    test('Outer subgraph node has no stale proxyWidgets after nested packing', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.nextFrame()

      const result = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        const outerNode = graph.getNodeById('10')
        if (
          !outerNode ||
          typeof outerNode.isSubgraphNode !== 'function' ||
          !outerNode.isSubgraphNode()
        ) {
          return { error: 'Node 10 is not a SubgraphNode' }
        }

        const proxyWidgets = (outerNode.properties?.proxyWidgets ??
          []) as string[][]
        const widgetTypes = (outerNode.widgets ?? []).map(
          (w: { type: string }) => w.type
        )

        return { proxyWidgets, widgetTypes }
      })

      if ('error' in result) {
        throw new Error(result.error)
      }

      // proxyWidgets should only contain ["3","seed"] (KSampler),
      // not the stale ["7","text"] or ["6","text"] entries
      expect(result.proxyWidgets).toEqual([['3', 'seed']])

      // No "button" type widgets (the Disconnected placeholder)
      expect(result.widgetTypes).not.toContain('button')
    })
  }
)
