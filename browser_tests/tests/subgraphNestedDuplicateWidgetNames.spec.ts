import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'
const WORKFLOW = 'subgraphs/nested-duplicate-widget-names'
const PROMOTED_BORDER_CLASS = 'ring-component-node-widget-promoted'

/**
 * Regression tests for nested subgraph promotion where multiple interior
 * nodes share the same widget name (e.g. two CLIPTextEncode nodes both
 * with a "text" widget).
 *
 * The inner subgraph (node 3) promotes both ["1","text"] and ["2","text"].
 * The outer subgraph (node 4) promotes through node 3 using identity
 * disambiguation (optional sourceNodeId in the promotion entry).
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

      const nonPreview = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        const outerNode = graph.getNodeById('4')
        if (
          !outerNode ||
          typeof outerNode.isSubgraphNode !== 'function' ||
          !outerNode.isSubgraphNode()
        ) {
          return []
        }

        const innerSubgraphNode = outerNode.subgraph.getNodeById(3)
        if (!innerSubgraphNode) return []

        return ((innerSubgraphNode.properties?.proxyWidgets ?? []) as unknown[])
          .filter(
            (entry): entry is [string, string] =>
              Array.isArray(entry) &&
              entry.length >= 2 &&
              typeof entry[0] === 'string' &&
              typeof entry[1] === 'string' &&
              !entry[1].startsWith('$$')
          )
          .map(
            ([nodeId, widgetName]) => [nodeId, widgetName] as [string, string]
          )
      })

      expect(nonPreview).toEqual([
        ['1', 'text'],
        ['2', 'text']
      ])
    })

    test('Promoted widget values from both inner CLIPTextEncode nodes are distinguishable', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.nextFrame()

      const widgetValues = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        const outerNode = graph.getNodeById('4')
        if (
          !outerNode ||
          typeof outerNode.isSubgraphNode !== 'function' ||
          !outerNode.isSubgraphNode()
        ) {
          return []
        }

        const innerSubgraphNode = outerNode.subgraph.getNodeById(3)
        if (!innerSubgraphNode) return []

        return (innerSubgraphNode.widgets ?? []).map((w) => ({
          name: w.name,
          value: w.value
        }))
      })

      const textWidgets = widgetValues.filter((w) => w.name.startsWith('text'))
      expect(textWidgets).toHaveLength(2)

      const values = textWidgets.map((w) => w.value)
      expect(values).toContain('11111111111')
      expect(values).toContain('22222222222')
    })

    test.describe('Promoted border styling in Vue mode', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      })

      test('Intermediate subgraph widgets get promoted border, outermost does not', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)
        await comfyPage.vueNodes.waitForNodes()

        // Node 4 is the outer SubgraphNode at root level.
        // Its widgets are not promoted further (no parent subgraph),
        // so none of its widget wrappers should carry the promoted ring.
        const outerNode = comfyPage.vueNodes.getNodeLocator('4')
        await expect(outerNode).toBeVisible()

        const outerPromotedRings = outerNode.locator(
          `.${PROMOTED_BORDER_CLASS}`
        )
        await expect(outerPromotedRings).toHaveCount(0)

        // Navigate into the outer subgraph (node 4) to reach node 3
        await comfyPage.vueNodes.enterSubgraph('4')
        await comfyPage.nextFrame()
        await comfyPage.vueNodes.waitForNodes()

        // Node 3 is the intermediate SubgraphNode whose "text" widgets
        // are promoted up to the outer subgraph (node 4).
        // Its widget wrappers should carry the promoted border ring.
        const intermediateNode = comfyPage.vueNodes.getNodeLocator('3')
        await expect(intermediateNode).toBeVisible()

        const intermediatePromotedRings = intermediateNode.locator(
          `.${PROMOTED_BORDER_CLASS}`
        )
        await expect(intermediatePromotedRings).toHaveCount(1)
      })
    })
  }
)
