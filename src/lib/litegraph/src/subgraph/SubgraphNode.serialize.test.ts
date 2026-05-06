/**
 * Tests for SubgraphNode.serialize() after ADR 0009.
 *
 * Covers:
 * - Removed copy-back loop: exterior promoted host value does NOT mutate
 *   the corresponding interior widget value.
 * - properties.proxyWidgets is no longer re-emitted on serialize.
 * - properties.previewExposures round-trip through the
 *   PreviewExposureStore.
 * - properties.proxyWidgetErrorQuarantine round-trips and is inert at
 *   runtime; an empty quarantine is omitted from the serialized payload.
 */
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  appendHostQuarantine,
  makeQuarantineEntry
} from '@/core/graph/subgraph/migration/quarantineEntry'
import type { SerializedProxyWidgetTuple } from '@/core/schemas/promotionSchema'
import type { ISlotType, TWidgetType } from '@/lib/litegraph/src/litegraph'
import { BaseWidget, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'

import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

function createNodeWithWidget(
  title: string,
  widgetType: TWidgetType = 'number',
  widgetValue: unknown = 42,
  slotType: ISlotType = 'number'
) {
  const node = new LGraphNode(title)
  const input = node.addInput('value', slotType)
  node.addOutput('out', slotType)

  // @ts-expect-error Abstract class instantiation
  const widget = new BaseWidget({
    name: 'widget',
    type: widgetType,
    value: widgetValue,
    y: 0,
    options: widgetType === 'number' ? { min: 0, max: 100, step: 1 } : {},
    node
  })
  node.widgets = [widget]
  input.widget = { name: widget.name }

  return { node, widget, input }
}

describe('SubgraphNode.serialize (ADR 0009)', () => {
  describe('removed copy-back loop', () => {
    it('does not call subgraphInput.getConnectedWidgets() during serialize', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'number' }]
      })

      const { node: interiorNode } = createNodeWithWidget('Interior')
      subgraph.add(interiorNode)
      subgraph.inputNode.slots[0].connect(
        interiorNode.inputs[0],
        interiorNode
      )

      const hostNode = createTestSubgraphNode(subgraph)

      // The pre-ADR-0009 copy-back loop iterated input._subgraphSlot
      // .getConnectedWidgets() and assigned the host wrapper's value to
      // every interior widget. After removal, serialize must not visit
      // that path at all, preventing cross-host stomping.
      const slot = hostNode.inputs.find((i) => i._subgraphSlot)
        ?._subgraphSlot
      expect(slot).toBeDefined()
      const spy = vi.spyOn(slot!, 'getConnectedWidgets')

      hostNode.serialize()

      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('proxyWidgets is no longer re-emitted', () => {
    it('does not write properties.proxyWidgets after serialize', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'number' }]
      })

      const { node: interiorNode } = createNodeWithWidget('Interior')
      subgraph.add(interiorNode)
      subgraph.inputNode.slots[0].connect(
        interiorNode.inputs[0],
        interiorNode
      )

      const hostNode = createTestSubgraphNode(subgraph)
      // Ensure no pre-existing proxyWidgets property leaks through.
      delete hostNode.properties.proxyWidgets

      const serialized = hostNode.serialize()

      expect(serialized.properties?.proxyWidgets).toBeUndefined()
      expect(hostNode.properties.proxyWidgets).toBeUndefined()
    })

    it('preserves a pre-existing legacy proxyWidgets property without re-deriving it', () => {
      const subgraph = createTestSubgraph()
      const hostNode = createTestSubgraphNode(subgraph)

      const legacy: SerializedProxyWidgetTuple[] = [['7', 'seed']]
      hostNode.properties.proxyWidgets = legacy

      const serialized = hostNode.serialize()

      // Still serialized as-is — not deleted, not rewritten.
      expect(serialized.properties?.proxyWidgets).toStrictEqual(legacy)
    })
  })

  describe('previewExposures round-trip', () => {
    it('writes previewExposures from the store on serialize', () => {
      const subgraph = createTestSubgraph()
      const hostNode = createTestSubgraphNode(subgraph)

      const store = usePreviewExposureStore()
      const rootGraphId = hostNode.rootGraph.id
      const hostLocator = createNodeLocatorId(rootGraphId, hostNode.id)

      store.addExposure(rootGraphId, hostLocator, {
        sourceNodeId: '12',
        sourcePreviewName: '$$canvas-image-preview'
      })
      store.addExposure(rootGraphId, hostLocator, {
        sourceNodeId: '14',
        sourcePreviewName: 'videopreview'
      })

      const serialized = hostNode.serialize()

      expect(serialized.properties?.previewExposures).toEqual([
        {
          name: '$$canvas-image-preview',
          sourceNodeId: '12',
          sourcePreviewName: '$$canvas-image-preview'
        },
        {
          name: 'videopreview',
          sourceNodeId: '14',
          sourcePreviewName: 'videopreview'
        }
      ])
    })

    it('omits previewExposures when the store has no entries for the host', () => {
      const subgraph = createTestSubgraph()
      const hostNode = createTestSubgraphNode(subgraph)
      hostNode.properties.previewExposures = [
        {
          name: 'stale',
          sourceNodeId: '0',
          sourcePreviewName: '$$canvas-image-preview'
        }
      ]

      const serialized = hostNode.serialize()

      expect(serialized.properties?.previewExposures).toBeUndefined()
      expect(hostNode.properties.previewExposures).toBeUndefined()
    })
  })

  describe('proxyWidgetErrorQuarantine', () => {
    it('preserves quarantine entries through serialize and is inert at runtime', () => {
      const subgraph = createTestSubgraph()
      const hostNode = createTestSubgraphNode(subgraph)

      appendHostQuarantine(hostNode, [
        makeQuarantineEntry({
          originalEntry: ['7', 'seed'],
          reason: 'missingSourceNode',
          hostValue: 42
        })
      ])

      const serialized = hostNode.serialize()
      const quarantine = serialized.properties?.proxyWidgetErrorQuarantine
      expect(Array.isArray(quarantine)).toBe(true)
      expect(quarantine).toHaveLength(1)

      // Inertness: quarantine entries do not produce widgets.
      expect(
        hostNode.widgets.some(
          (w) => 'sourceNodeId' in w && w.sourceNodeId === '7'
        )
      ).toBe(false)
    })

    it('removes the property entirely when quarantine is empty', () => {
      const subgraph = createTestSubgraph()
      const hostNode = createTestSubgraphNode(subgraph)
      hostNode.properties.proxyWidgetErrorQuarantine = []

      const serialized = hostNode.serialize()

      expect(
        serialized.properties?.proxyWidgetErrorQuarantine
      ).toBeUndefined()
      expect(hostNode.properties.proxyWidgetErrorQuarantine).toBeUndefined()
    })
  })
})
