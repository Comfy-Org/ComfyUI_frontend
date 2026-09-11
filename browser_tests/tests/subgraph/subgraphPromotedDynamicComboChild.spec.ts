import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
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

      // Polled as one snapshot: a dropped promotion link leaves the input
      // rendering as a bare slot and makes auto-promotion mint a duplicate
      // `<name>_1`, so asserting these separately could read a half-built node.
      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            ({ id, name }) => {
              const node = window.app?.graph.getNodeById(id)
              if (!node) return undefined
              const names = node.inputs.map((input) => input.name)
              return {
                rendersAsWidget: node.inputs.some(
                  (input) => input.name === name && Boolean(input.widget)
                ),
                hasDuplicate: names.includes(`${name}_1`),
                promotedValue: node.widgets?.find((w) => w.name === name)?.value
              }
            },
            { id: toNodeId(HOST_NODE_ID), name: PROMOTED_INPUT }
          )
        )
        .toEqual({
          rendersAsWidget: true,
          hasDuplicate: false,
          promotedValue: 4
        })
    })
  }
)
