import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { classifyProxyEntry } from '@/core/graph/subgraph/migration/classifyProxyEntry'
import type {
  PromotedWidgetSource,
  PromotedWidgetView
} from '@/core/graph/subgraph/promotedWidgetTypes'

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

function buildHost(): SubgraphNode {
  const subgraph = createTestSubgraph()
  const hostNode = createTestSubgraphNode(subgraph)
  const graph = hostNode.graph!
  graph.add(hostNode)
  return hostNode
}

function makeSource(
  sourceNodeId: string,
  sourceWidgetName: string
): PromotedWidgetSource {
  return { sourceNodeId, sourceWidgetName }
}

describe(classifyProxyEntry, () => {
  describe('alreadyLinked branch', () => {
    it('returns alreadyLinked when an input already represents the entry', () => {
      const host = buildHost()
      const innerNode = new LGraphNode('Inner')
      innerNode.addWidget('number', 'seed', 0, () => {})
      host.subgraph.add(innerNode)

      const inputSlot = host.addInput('seed_link', '*')
      inputSlot._widget = fromPartial<PromotedWidgetView>({
        node: host,
        name: 'seed',
        sourceNodeId: String(innerNode.id),
        sourceWidgetName: 'seed'
      })

      const normalized = makeSource(String(innerNode.id), 'seed')
      const result = classifyProxyEntry({
        hostNode: host,
        normalized,
        cohort: [normalized]
      })

      expect(result.classification).toBe('value')
      expect(result.plan).toEqual({
        kind: 'alreadyLinked',
        subgraphInputName: 'seed_link'
      })
    })
  })

  describe('quarantine branches', () => {
    it('quarantines when source node is missing', () => {
      const host = buildHost()
      const normalized = makeSource('999', 'seed')

      const result = classifyProxyEntry({
        hostNode: host,
        normalized,
        cohort: [normalized]
      })

      expect(result).toEqual({
        classification: 'unknown',
        plan: { kind: 'quarantine', reason: 'missingSourceNode' }
      })
    })

    it('quarantines when source widget is missing on the source node', () => {
      const host = buildHost()
      const innerNode = new LGraphNode('Inner')
      host.subgraph.add(innerNode)

      const normalized = makeSource(String(innerNode.id), 'nonexistent')
      const result = classifyProxyEntry({
        hostNode: host,
        normalized,
        cohort: [normalized]
      })

      expect(result).toEqual({
        classification: 'unknown',
        plan: { kind: 'quarantine', reason: 'missingSourceWidget' }
      })
    })

    it('quarantines an unlinked primitive node with no fan-out', () => {
      const host = buildHost()
      const primitive = new LGraphNode('Primitive')
      primitive.type = 'PrimitiveNode'
      primitive.addOutput('value', '*')
      host.subgraph.add(primitive)

      const normalized = makeSource(String(primitive.id), 'value')
      const result = classifyProxyEntry({
        hostNode: host,
        normalized,
        cohort: [normalized]
      })

      expect(result).toEqual({
        classification: 'unknown',
        plan: { kind: 'quarantine', reason: 'unlinkedSourceWidget' }
      })
    })
  })

  describe('preview branch', () => {
    it('classifies $$-prefixed names as preview exposure', () => {
      const host = buildHost()
      const innerNode = new LGraphNode('Inner')
      innerNode.addWidget('text', '$$canvas-image-preview', '', () => {})
      host.subgraph.add(innerNode)

      const normalized = makeSource(
        String(innerNode.id),
        '$$canvas-image-preview'
      )
      const result = classifyProxyEntry({
        hostNode: host,
        normalized,
        cohort: [normalized]
      })

      expect(result.classification).toBe('preview')
      expect(result.plan).toEqual({
        kind: 'previewExposure',
        sourcePreviewName: '$$canvas-image-preview'
      })
    })

    it('classifies type:preview serialize:false widgets as preview exposure', () => {
      const host = buildHost()
      const innerNode = new LGraphNode('Inner')
      const widget = innerNode.addWidget('text', 'videopreview', '', () => {})
      widget.type = 'preview'
      widget.serialize = false
      host.subgraph.add(innerNode)

      const normalized = makeSource(String(innerNode.id), 'videopreview')
      const result = classifyProxyEntry({
        hostNode: host,
        normalized,
        cohort: [normalized]
      })

      expect(result.classification).toBe('preview')
      expect(result.plan).toEqual({
        kind: 'previewExposure',
        sourcePreviewName: 'videopreview'
      })
    })
  })

  describe('value-widget branch', () => {
    it('plans a createSubgraphInput when the widget exists and is not linked', () => {
      const host = buildHost()
      const innerNode = new LGraphNode('Inner')
      innerNode.addWidget('number', 'seed', 42, () => {})
      host.subgraph.add(innerNode)

      const normalized = makeSource(String(innerNode.id), 'seed')
      const result = classifyProxyEntry({
        hostNode: host,
        normalized,
        cohort: [normalized]
      })

      expect(result).toEqual({
        classification: 'value',
        plan: { kind: 'createSubgraphInput', sourceWidgetName: 'seed' }
      })
    })
  })

  describe('primitive fanout branch', () => {
    it('emits primitiveBypass with target list when cohort points at the same primitive', () => {
      const host = buildHost()

      const primitive = new LGraphNode('Primitive')
      primitive.type = 'PrimitiveNode'
      primitive.addOutput('value', 'INT')
      host.subgraph.add(primitive)

      const targetA = new LGraphNode('TargetA')
      targetA.addInput('value', 'INT')
      targetA.addWidget('number', 'seed', 0, () => {})
      host.subgraph.add(targetA)

      const targetB = new LGraphNode('TargetB')
      targetB.addInput('value', 'INT')
      targetB.addWidget('number', 'seed', 0, () => {})
      host.subgraph.add(targetB)

      primitive.connect(0, targetA, 0)
      primitive.connect(0, targetB, 0)

      const sourceA = makeSource(String(primitive.id), 'seed')
      // Cohort has 2 entries pointing at the primitive (one per target).
      const cohort = [sourceA, sourceA]

      const result = classifyProxyEntry({
        hostNode: host,
        normalized: sourceA,
        cohort
      })

      expect(result.classification).toBe('primitiveFanout')
      expect(result.plan.kind).toBe('primitiveBypass')
      if (result.plan.kind !== 'primitiveBypass') return
      expect(result.plan.primitiveNodeId).toBe(primitive.id)
      expect(result.plan.sourceWidgetName).toBe('seed')
      expect(result.plan.targets).toHaveLength(2)
      expect(result.plan.targets.map((t) => t.targetNodeId)).toEqual(
        expect.arrayContaining([targetA.id, targetB.id])
      )
    })
  })
})
