import { describe, expect, it, vi } from 'vitest'

import { promotedInputWidget } from '@/core/graph/subgraph/promotedInputWidget'
import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { createPromotedWidgetStoreProjection } from '@/lib/litegraph/src/subgraph/promotedWidgetStoreProjection'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

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

  it('warns when the app-layer projection loses its store entry', () => {
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
    const hostInput = host.inputs[0]
    const id = hostInput.widgetId
    expect(id).toBeDefined()
    if (!id) throw new Error('Expected promoted widget ID')
    const promotedWidget = promotedInputWidget(hostInput)
    expect(promotedWidget).not.toBeNull()
    if (!promotedWidget) throw new Error('Expected promoted widget')
    useWidgetValueStore().deleteWidget(id)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    promotedWidget.options = { min: 0 }

    expect(warn).toHaveBeenCalledWith(
      'promotedInputWidget: ignored options for missing widget',
      id
    )
  })

  it('warns when the litegraph projection loses its store entry', () => {
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
    const hostInput = host.inputs[0]
    const id = hostInput.widgetId
    expect(id).toBeDefined()
    if (!id) throw new Error('Expected promoted widget ID')
    const promotedWidget = createPromotedWidgetStoreProjection(hostInput, id)
    useWidgetValueStore().deleteWidget(id)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    promotedWidget.options = { min: 0 }

    expect(warn).toHaveBeenCalledWith(
      'createPromotedWidgetStoreProjection: ignored options for missing widget',
      id
    )
  })
})
