import { describe, expect, it, vi } from 'vitest'

import type {
  ExportedSubgraphInstance,
  Subgraph,
  TWidgetValue
} from '@/lib/litegraph/src/litegraph'
import { LGraphNode, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetId } from '@/types/widgetId'

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

import { promoteValueWidgetViaSubgraphInput } from './promotionUtils'

const HOST_ID = 7

function promotedWidgetId(host: SubgraphNode, name: string): WidgetId {
  const input = host.inputs.find((input) => input.name === name)
  if (!input?.widgetId) throw new Error(`Missing promoted input ${name}`)
  return input.widgetId
}

function promotedValue(host: SubgraphNode, name: string) {
  return useWidgetValueStore().getWidget(promotedWidgetId(host, name))?.value
}

/**
 * A root graph holding one host `SubgraphNode` (id {@link HOST_ID}) whose
 * subgraph contains a single interior node. `value` (text, `'initial'`) is
 * always promoted; `count` (number, `5`) is promoted when `withSibling`.
 */
function buildPromotedHost(withSibling = false) {
  const subgraph = createTestSubgraph()
  const host = createTestSubgraphNode(subgraph, { id: HOST_ID })
  subgraph.rootGraph.add(host)

  const interior = new LGraphNode('TestNode')
  subgraph.add(interior)

  const valueInput = interior.addInput('value', 'STRING')
  const valueWidget = interior.addWidget('text', 'value', 'initial', () => {})
  valueInput.widget = { name: valueWidget.name }
  expect(
    promoteValueWidgetViaSubgraphInput(host, interior, valueWidget).ok
  ).toBe(true)

  if (withSibling) {
    const countInput = interior.addInput('count', 'INT')
    const countWidget = interior.addWidget('number', 'count', 5, () => {})
    countInput.widget = { name: countWidget.name }
    expect(
      promoteValueWidgetViaSubgraphInput(host, interior, countWidget).ok
    ).toBe(true)
  }

  return { subgraph, host, interior, valueWidget }
}

function connectExternalLink(subgraph: Subgraph, host: SubgraphNode) {
  const upstream = new LGraphNode('Upstream')
  upstream.addOutput('out', 'STRING')
  subgraph.rootGraph.add(upstream)
  expect(upstream.connect(0, host, 0)).toBeTruthy()
  return upstream
}

/**
 * `widgets_values` as it arrives from a saved workflow file. Typed as JSON
 * because `TWidgetValue` excludes `null`, which a saved file can still contain.
 */
function savedWidgetValues(json: string): TWidgetValue[] {
  return JSON.parse(json) as TWidgetValue[]
}

function reloadHost(
  subgraph: Subgraph,
  id: number,
  widgets_values: TWidgetValue[]
): SubgraphNode {
  const instance: ExportedSubgraphInstance = {
    id,
    type: subgraph.id,
    pos: [100, 100],
    size: [200, 100],
    inputs: [],
    outputs: [],
    properties: {},
    flags: {},
    mode: 0,
    order: 0,
    widgets_values
  }
  const host = new SubgraphNode(subgraph.rootGraph, subgraph, instance)
  subgraph.rootGraph.add(host)
  return host
}

describe('promoted widget survival across host replacement', () => {
  describe('same-id host replacement', () => {
    it('keeps the promoted widgetId and its null value when the host is replaced', async () => {
      const { subgraph, host } = buildPromotedHost(true)
      const store = useWidgetValueStore()
      const valueId = promotedWidgetId(host, 'value')
      const countId = promotedWidgetId(host, 'count')
      store.setValue(valueId, null)
      store.setValue(countId, 42)

      const upstream = connectExternalLink(subgraph, host)
      subgraph.rootGraph.remove(host)
      await Promise.resolve()

      expect(store.getWidget(valueId)?.value).toBeNull()

      const replacement = createTestSubgraphNode(subgraph, { id: HOST_ID })
      subgraph.rootGraph.add(replacement)

      expect(promotedWidgetId(replacement, 'value')).toBe(valueId)
      expect(promotedWidgetId(replacement, 'count')).toBe(countId)
      expect(promotedValue(replacement, 'value')).toBeNull()
      expect(promotedValue(replacement, 'count')).toBe(42)

      expect(upstream.connect(0, replacement, 0)).toBeTruthy()
      expect(replacement.inputs[0].link).not.toBeNull()
      expect(promotedValue(replacement, 'value')).toBeNull()
    })

    it('discards the null host value when the interior widget type changes', async () => {
      const { subgraph, host, valueWidget } = buildPromotedHost()
      const store = useWidgetValueStore()
      const valueId = promotedWidgetId(host, 'value')
      store.setValue(valueId, null)

      subgraph.rootGraph.remove(host)
      await Promise.resolve()
      valueWidget.type = 'number'

      const replacement = createTestSubgraphNode(subgraph, { id: HOST_ID })
      subgraph.rootGraph.add(replacement)

      expect(promotedWidgetId(replacement, 'value')).toBe(valueId)
      expect(store.getWidget(valueId)?.type).toBe('number')
      expect(promotedValue(replacement, 'value')).toBe('initial')
    })
  })

  describe('null is a value, not absence', () => {
    it('omits widgets_values entirely when the only promoted value is null', () => {
      const { host } = buildPromotedHost()
      const store = useWidgetValueStore()
      const valueId = promotedWidgetId(host, 'value')

      store.setValue(valueId, 0)
      expect(host.serialize().widgets_values).toEqual([0])

      store.setValue(valueId, null)
      expect(promotedValue(host, 'value')).toBeNull()
      expect('widgets_values' in host.serialize()).toBe(false)
    })

    it('serializes a null promoted value as an undefined slot beside a live sibling', () => {
      const { host } = buildPromotedHost(true)
      const store = useWidgetValueStore()
      store.setValue(promotedWidgetId(host, 'value'), null)
      store.setValue(promotedWidgetId(host, 'count'), 42)

      const widgetValues = host.serialize().widgets_values
      expect(widgetValues).toHaveLength(2)
      expect(widgetValues?.[0]).toBeUndefined()
      expect(widgetValues?.[1]).toBe(42)
      expect(JSON.parse(JSON.stringify(widgetValues))).toEqual([null, 42])
    })

    it('restores a saved null entry, but falls back to the interior default when the entry is absent', () => {
      const { subgraph } = buildPromotedHost(true)

      const restored = reloadHost(subgraph, 20, savedWidgetValues('[null, 42]'))
      expect(promotedValue(restored, 'value')).toBeNull()
      expect(promotedValue(restored, 'count')).toBe(42)

      const truncated = reloadHost(subgraph, 21, savedWidgetValues('[42]'))
      expect(promotedValue(truncated, 'value')).toBe(42)
      expect(promotedValue(truncated, 'count')).toBe(5)
    })
  })

  describe('definition input removed and recreated', () => {
    it('deletes the null-valued entry and rebuilds it from the interior widget', async () => {
      const { subgraph, host, interior, valueWidget } = buildPromotedHost()
      const store = useWidgetValueStore()
      const valueId = promotedWidgetId(host, 'value')
      store.setValue(valueId, null)

      subgraph.removeInput(subgraph.inputs[0])
      await Promise.resolve()

      expect(host.inputs).toHaveLength(0)
      expect(store.getWidget(valueId)).toBeUndefined()

      expect(
        promoteValueWidgetViaSubgraphInput(host, interior, valueWidget).ok
      ).toBe(true)

      expect(promotedWidgetId(host, 'value')).toBe(valueId)
      expect(promotedValue(host, 'value')).toBe('initial')
    })
  })
})
