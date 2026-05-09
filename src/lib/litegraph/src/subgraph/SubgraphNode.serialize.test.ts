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
      subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

      const hostNode = createTestSubgraphNode(subgraph)

      // The pre-ADR-0009 copy-back loop iterated input._subgraphSlot
      // .getConnectedWidgets() and assigned the host wrapper's value to
      // every interior widget. After removal, serialize must not visit
      // that path at all, preventing cross-host stomping.
      const slot = hostNode.inputs.find((i) => i._subgraphSlot)?._subgraphSlot
      expect(slot).toBeDefined()
      const spy = vi.spyOn(slot!, 'getConnectedWidgets')

      hostNode.serialize()

      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('host widget values', () => {
    it('serializes promoted values from each host independently', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'number' }]
      })

      const { node: interiorNode } = createNodeWithWidget('Interior')
      subgraph.add(interiorNode)
      subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

      const firstHost = createTestSubgraphNode(subgraph, { id: 101 })
      const secondHost = createTestSubgraphNode(subgraph, { id: 102 })
      subgraph.rootGraph.add(firstHost)
      subgraph.rootGraph.add(secondHost)

      firstHost.widgets[0].value = 111
      secondHost.widgets[0].value = 222

      expect(firstHost.serialize().widgets_values).toEqual([111])
      expect(secondHost.serialize().widgets_values).toEqual([222])
    })
  })

  describe('proxyWidgets is no longer re-emitted', () => {
    it('does not write properties.proxyWidgets after serialize', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'number' }]
      })

      const { node: interiorNode } = createNodeWithWidget('Interior')
      subgraph.add(interiorNode)
      subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

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
    it('hydrates previewExposures into the store during configure', () => {
      const subgraph = createTestSubgraph()
      const hostNode = createTestSubgraphNode(subgraph)
      const rootGraphId = hostNode.rootGraph.id
      const hostLocator = String(hostNode.id)

      hostNode.properties.previewExposures = [
        {
          name: 'preview',
          sourceNodeId: '12',
          sourcePreviewName: '$$canvas-image-preview'
        }
      ]

      hostNode._internalConfigureAfterSlots()

      expect(
        usePreviewExposureStore().getExposures(rootGraphId, hostLocator)
      ).toEqual([
        {
          name: 'preview',
          sourceNodeId: '12',
          sourcePreviewName: '$$canvas-image-preview'
        }
      ])
    })

    it('writes previewExposures from the store on serialize', () => {
      const subgraph = createTestSubgraph()
      const hostNode = createTestSubgraphNode(subgraph)

      const store = usePreviewExposureStore()
      const rootGraphId = hostNode.rootGraph.id
      const hostLocator = String(hostNode.id)

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

    it('serializes preview exposures per host instance', () => {
      const subgraph = createTestSubgraph()
      const firstHost = createTestSubgraphNode(subgraph, { id: 101 })
      const secondHost = createTestSubgraphNode(subgraph, { id: 102 })
      subgraph.rootGraph.add(firstHost)
      subgraph.rootGraph.add(secondHost)

      const store = usePreviewExposureStore()
      const rootGraphId = firstHost.rootGraph.id

      store.addExposure(rootGraphId, String(firstHost.id), {
        sourceNodeId: '12',
        sourcePreviewName: '$$canvas-image-preview'
      })
      store.addExposure(rootGraphId, String(secondHost.id), {
        sourceNodeId: '14',
        sourcePreviewName: 'videopreview'
      })

      const firstExposures = firstHost.serialize().properties?.previewExposures
      const secondExposures =
        secondHost.serialize().properties?.previewExposures

      expect(Array.isArray(firstExposures)).toBe(true)
      expect(Array.isArray(secondExposures)).toBe(true)
      if (!Array.isArray(firstExposures) || !Array.isArray(secondExposures))
        throw new Error('Expected serialized previewExposures arrays')

      expect(firstExposures).toEqual([
        {
          name: '$$canvas-image-preview',
          sourceNodeId: '12',
          sourcePreviewName: '$$canvas-image-preview'
        }
      ])
      expect(secondExposures).toEqual([
        {
          name: 'videopreview',
          sourceNodeId: '14',
          sourcePreviewName: 'videopreview'
        }
      ])
      expect(firstExposures?.[0]).not.toHaveProperty('hostInstanceId')
      expect(firstExposures?.[0]).not.toHaveProperty('hostNodeLocator')
      expect(firstExposures?.[0]).not.toHaveProperty('rootGraphId')
      expect(secondExposures?.[0]).not.toHaveProperty('hostInstanceId')
      expect(secondExposures?.[0]).not.toHaveProperty('hostNodeLocator')
      expect(secondExposures?.[0]).not.toHaveProperty('rootGraphId')
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

      expect(serialized.properties?.proxyWidgetErrorQuarantine).toBeUndefined()
      expect(hostNode.properties.proxyWidgetErrorQuarantine).toBeUndefined()
    })
  })
})
