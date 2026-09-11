import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { getPromotedWidgetNames } from '@e2e/fixtures/utils/promotedWidgets'
import { toNodeId } from '@/types/nodeId'

// Regression fixture for FE-258: `resize_type.multiplier` is a child widget of
// a NON-default `DynamicCombo` option on `Resize Image/Mask`, promoted through
// a subgraph boundary. The node is rebuilt at its default option during load,
// so the promotion link lands on the wrong child slot unless input links are
// realigned by name before widget values swap the slots out.
const WORKFLOW = 'subgraphs/subgraph-promoted-dynamic-combo-child'
const HOST_NODE_ID = '11'
const PROMOTED_INPUT = 'resize_type.multiplier'

test.describe(
  'Subgraph promotion of a dynamic-combo child widget',
  { tag: ['@subgraph', '@widget'] },
  () => {
    test('restores the promoted widget instead of a disconnected input slot', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)

      // Settle-wait only. This resolves the *interior* widget name, which the
      // duplicate host input also maps to, so it holds either way.
      await expect
        .poll(() => getPromotedWidgetNames(comfyPage, HOST_NODE_ID))
        .toContain(PROMOTED_INPUT)

      const inputs = await comfyPage.page.evaluate((id) => {
        const node = window.app?.graph.getNodeById(id)
        if (!node) throw new Error(`Expected subgraph host node ${id}`)
        return node.inputs.map((input) => ({
          name: input.name,
          rendersAsWidget: Boolean(input.widget)
        }))
      }, toNodeId(HOST_NODE_ID))

      expect(inputs).toContainEqual({
        name: PROMOTED_INPUT,
        rendersAsWidget: true
      })

      // A dropped promotion link makes auto-promotion mint a second, uniquely
      // named input for the same interior widget and append it to the node.
      expect(inputs.map(({ name }) => name)).not.toContain(
        `${PROMOTED_INPUT}_1`
      )

      const promotedValue = await comfyPage.page.evaluate(
        ({ id, name }) => {
          const node = window.app?.graph.getNodeById(id)
          return node?.widgets?.find((w) => w.name === name)?.value
        },
        { id: toNodeId(HOST_NODE_ID), name: PROMOTED_INPUT }
      )
      expect(promotedValue).toBe(4)
    })
  }
)
