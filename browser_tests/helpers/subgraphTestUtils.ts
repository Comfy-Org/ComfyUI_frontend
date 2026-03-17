import type { Page } from '@playwright/test'

import type { LGraph, Subgraph } from '../../src/lib/litegraph/src/litegraph'
import { isSubgraph } from '../../src/utils/typeGuardUtil'

/**
 * Assertion helper for tests where being in a subgraph is a precondition.
 * Throws a clear error if the graph is not a Subgraph.
 */
export function assertSubgraph(
  graph: LGraph | Subgraph | null | undefined
): asserts graph is Subgraph {
  if (!isSubgraph(graph)) {
    throw new Error(
      'Expected to be in a subgraph context, but graph is not a Subgraph'
    )
  }
}

/**
 * Returns the widget-input slot Y position and the node title height
 * for the promoted "text" input on the SubgraphNode.
 *
 * The slot Y should be at the widget row, not the header. A value near
 * zero or negative indicates the slot is positioned at the header (the bug).
 */
export function getTextSlotPosition(page: Page, nodeId: string) {
  return page.evaluate((id) => {
    const node = window.app!.canvas.graph!.getNodeById(id)
    if (!node) return null

    const titleHeight = window.LiteGraph!.NODE_TITLE_HEIGHT

    for (const input of node.inputs) {
      if (!input.widget || input.type !== 'STRING') continue
      return {
        hasPos: !!input.pos,
        posY: input.pos?.[1] ?? null,
        widgetName: input.widget.name,
        titleHeight
      }
    }
    return null
  }, nodeId)
}
