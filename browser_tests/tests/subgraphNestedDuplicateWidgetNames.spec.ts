import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'
import { getPromotedWidgets } from '../helpers/promotedWidgets'

const WORKFLOW = 'subgraphs/nested-duplicate-widget-names'

/**
 * Regression tests for nested subgraph promotion where multiple interior
 * nodes share the same widget name (e.g. two CLIPTextEncode nodes both
 * with a "text" widget).
 *
 * The inner subgraph (node 3) promotes both ["1","text"] and ["2","text"].
 * Widget names are uniquified ("text", "text_1") so the outer subgraph
 * can promote both through distinct lookup keys.
 *
 * See: https://github.com/Comfy-Org/ComfyUI_frontend/pull/10123#discussion_r2956230977
 */
test.describe(
  'Nested subgraph duplicate widget names',
  { tag: ['@subgraph', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    })

    test('Inner subgraph node has both text widgets promoted', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.nextFrame()

      // Node 4 is the outer subgraph; navigate into it to see node 3
      const outerNode = await comfyPage.nodeOps.getNodeRefById('4')
      await outerNode.navigateIntoSubgraph()

      // Node 3 is the inner subgraph node — it should have both
      // CLIPTextEncode "text" widgets promoted (from nodes 1 and 2)
      const innerPromoted = await getPromotedWidgets(comfyPage, '3')
      const nonPreview = innerPromoted.filter(
        ([, name]) => !name.startsWith('$$')
      )

      expect(nonPreview).toEqual([
        ['1', 'text'],
        ['2', 'text']
      ])
    })

    test('Both text widgets from inner subgraph are promotable on the outer subgraph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.nextFrame()

      // Node 3 (inner SubgraphNode) has proxyWidgets [["1","text"],["2","text"]].
      // After uniquification, its widgets should have distinct names.
      const innerWidgetNames = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        const outerNode = graph.getNodeById('4')
        if (
          !outerNode ||
          typeof outerNode.isSubgraphNode !== 'function' ||
          !outerNode.isSubgraphNode()
        ) {
          return []
        }

        const outerSubgraph = outerNode.subgraph
        const innerSubgraphNode = outerSubgraph.getNodeById(3)
        if (!innerSubgraphNode) return []

        return (innerSubgraphNode.widgets ?? []).map((w) => w.name)
      })

      // The two "text" widgets should be uniquified to "text" and "text_1"
      const textWidgets = innerWidgetNames.filter((n) => n.startsWith('text'))
      expect(textWidgets).toHaveLength(2)
      expect(textWidgets).toContain('text')
      expect(textWidgets).toContain('text_1')
    })

    test('Promoted widget values from both inner CLIPTextEncode nodes are distinguishable', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.nextFrame()

      // Navigate into the outer subgraph to reach node 3
      const outerNode = await comfyPage.nodeOps.getNodeRefById('4')
      await outerNode.navigateIntoSubgraph()

      // Read widget values from node 3 (the inner subgraph node)
      const widgetValues = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        const node = graph.getNodeById('3')
        if (!node) return []
        return (node.widgets ?? []).map((w) => ({
          name: w.name,
          value: w.value
        }))
      })

      // With uniquification, widgets are "text" and "text_1"
      const textWidgets = widgetValues.filter((w) => w.name.startsWith('text'))
      expect(textWidgets).toHaveLength(2)

      const values = textWidgets.map((w) => w.value)
      expect(values).toContain('11111111111')
      expect(values).toContain('22222222222')
    })
  }
)
