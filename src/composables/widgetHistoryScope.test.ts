import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { Subgraph } from '@/lib/litegraph/src/LGraph'
import { app } from '@/scripts/app'
import { toNodeId } from '@/types/nodeId'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { widgetId } from '@/types/widgetId'

import { widgetHistoryScope } from './widgetHistoryScope'

vi.mock(import('@/scripts/app'))

const SUBGRAPH_ID = '00000000-0000-4000-8000-0000000000b1'
const CANVAS_GRAPH_ID = '00000000-0000-4000-8000-0000000000c1'

describe(widgetHistoryScope, () => {
  it('keys a root graph widget by the root graph', () => {
    const scope = widgetHistoryScope({
      name: 'curve',
      nodeLocatorId: createNodeLocatorId(null, toNodeId(3))
    })

    expect(scope).toEqual({
      rootGraphId: app.rootGraph.id,
      widgetId: widgetId(app.rootGraph.id, toNodeId(3), 'curve')
    })
  })

  it('keys a subgraph widget by its subgraph while the canvas shows another graph', () => {
    app.canvas.graph = fromPartial({ id: CANVAS_GRAPH_ID })
    app.rootGraph.subgraphs.set(
      SUBGRAPH_ID,
      fromPartial<Subgraph>({ id: SUBGRAPH_ID })
    )

    const scope = widgetHistoryScope({
      name: 'curve',
      nodeLocatorId: createNodeLocatorId(SUBGRAPH_ID, toNodeId(4))
    })

    expect(scope).toEqual({
      rootGraphId: app.rootGraph.id,
      widgetId: widgetId(SUBGRAPH_ID, toNodeId(4), 'curve')
    })
  })

  it('has no scope for a widget in an unknown subgraph', () => {
    expect(
      widgetHistoryScope({
        name: 'curve',
        nodeLocatorId: createNodeLocatorId(SUBGRAPH_ID, toNodeId(4))
      })
    ).toBeNull()
  })

  it('falls back to the canvas graph and the given node without a locator', () => {
    app.canvas.graph = fromPartial({ id: CANVAS_GRAPH_ID })

    expect(widgetHistoryScope({ name: 'curve' }, toNodeId(5))).toEqual({
      rootGraphId: app.rootGraph.id,
      widgetId: widgetId(CANVAS_GRAPH_ID, toNodeId(5), 'curve')
    })
  })

  it('has no scope without a locator or a fallback node', () => {
    expect(widgetHistoryScope({ name: 'curve' })).toBeNull()
  })
})
