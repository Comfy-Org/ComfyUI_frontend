import { describe, expect, it, vi } from 'vitest'

import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

vi.mock<unknown>(import('@/services/litegraphService'), () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

describe('promoted subgraph widget options reassignment', () => {
  // https://comfy-org.sentry.io/issues/FRONTEND-80
  //
  // comfyui-combofilter (and other legacy extensions that filter COMBO
  // values) blindly reassign `widget.options = {...}` for every widget it
  // finds on a node. `SubgraphNode.widgets` projects each promoted input
  // through `promotedInputWidget`/`createPromotedWidgetStoreProjection`,
  // whose `options` is a getter with no setter, so the reassignment throws a
  // TypeError instead of replacing the options object - crashing the whole
  // extension on load.
  it.fails('reassigning options on a promoted subgraph widget does not throw', () => {
    const subgraph = createTestSubgraph()
    const host = createTestSubgraphNode(subgraph)

    const interior = new LGraphNode('SourceNode')
    subgraph.add(interior)
    const input = interior.addInput('text', 'STRING')
    const interiorWidget = interior.addWidget('text', 'text', 'hello', () => {})
    input.widget = { name: interiorWidget.name }

    expect(
      promoteValueWidgetViaSubgraphInput(host, interior, interiorWidget).ok
    ).toBe(true)

    const promotedWidget = host.widgets[0]
    expect(promotedWidget.name).toBe('text')

    expect(() => {
      promotedWidget.options = { ...promotedWidget.options }
    }).not.toThrow()
  })
})
