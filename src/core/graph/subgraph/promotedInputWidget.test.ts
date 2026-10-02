import { describe, expect, it, vi } from 'vitest'

import { promotedInputWidget } from '@/core/graph/subgraph/promotedInputWidget'
import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

vi.mock(import('@/services/litegraphService'))

describe('promoted subgraph widget options reassignment', () => {
  // https://comfy-org.sentry.io/issues/FRONTEND-80
  it('replaces options through the app-layer projection', () => {
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

    const promotedWidget = promotedInputWidget(host.inputs[0])
    expect(promotedWidget?.name).toBe('text')
    if (!promotedWidget) throw new Error('Expected promoted widget')

    promotedWidget.options = { min: 0 }
    promotedWidget.options = { multiline: true }

    expect(promotedWidget.options).toEqual({ multiline: true })
  })
})
