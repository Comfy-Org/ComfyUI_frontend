import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LGraph,
  LGraphNode,
  LiteGraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import type { TWidgetValue } from '@/lib/litegraph/src/types/widgets'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import {
  flushProxyWidgetMigration,
  readHostQuarantine
} from '@/core/graph/subgraph/migration/proxyWidgetMigration'
import type { PromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
  LGraph.proxyWidgetMigrationFlush = undefined
})

function buildHost(): SubgraphNode {
  const subgraph = createTestSubgraph()
  const hostNode = createTestSubgraphNode(subgraph)
  hostNode.graph!.add(hostNode)
  return hostNode
}

function addInnerNode(
  host: SubgraphNode,
  type: string,
  build: (node: LGraphNode) => void = () => {}
): LGraphNode {
  const node = new LGraphNode(type)
  build(node)
  host.subgraph.add(node)
  return node
}

function addPromotedHostInput(
  host: SubgraphNode,
  args: {
    inputName: string
    promotedName: string
    sourceNodeId: string
    sourceWidgetName: string
    initialValue?: TWidgetValue
  }
): { setValue: (v: TWidgetValue) => void; getValue: () => TWidgetValue } {
  let widgetValue: TWidgetValue = args.initialValue ?? 0
  const slot = host.addInput(args.inputName, '*')
  slot._widget = fromPartial<PromotedWidgetView>({
    node: host,
    name: args.promotedName,
    sourceNodeId: args.sourceNodeId,
    sourceWidgetName: args.sourceWidgetName,
    get value() {
      return widgetValue
    },
    set value(v: TWidgetValue) {
      widgetValue = v
    },
    hydrateHostValue(v: TWidgetValue) {
      widgetValue = v
    }
  })
  return {
    setValue: (v) => {
      widgetValue = v
    },
    getValue: () => widgetValue
  }
}

function addPrimitiveWithTargets(
  host: SubgraphNode,
  args: {
    primitiveType?: string
    primitiveValue?: number
    targetCount: number
    outputType?: string
    targetSlotType?: string
  }
): { primitive: LGraphNode; targets: LGraphNode[] } {
  const outputType = args.outputType ?? 'INT'
  const targetSlotType = args.targetSlotType ?? outputType
  const primitive = new LGraphNode('PrimitiveNode')
  primitive.type = 'PrimitiveNode'
  primitive.addOutput('value', outputType)
  primitive.addWidget('number', 'value', args.primitiveValue ?? 42, () => {})
  host.subgraph.add(primitive)

  const targets: LGraphNode[] = []
  for (let i = 0; i < args.targetCount; i++) {
    const target = new LGraphNode(`Target${i}`)
    const slot = target.addInput('value', targetSlotType)
    slot.widget = { name: 'value' }
    target.addWidget('number', 'value', 0, () => {})
    host.subgraph.add(target)
    primitive.connect(0, target, 0)
    targets.push(target)
  }
  return { primitive, targets }
}

describe('flushProxyWidgetMigration', () => {
  describe('no-op cases', () => {
    it('returns an empty result when no proxyWidgets are present', () => {
      const host = buildHost()

      const result = flushProxyWidgetMigration({ hostNode: host })

      expect(result).toEqual({
        repaired: 0,
        primitiveRepaired: 0,
        previewMigrated: 0,
        quarantined: 0
      })
      expect(host.properties.proxyWidgets).toBeUndefined()
    })

    it('tolerates a malformed proxyWidgets payload and returns empty', () => {
      const host = buildHost()
      host.properties.proxyWidgets = '{not json}'

      const result = flushProxyWidgetMigration({ hostNode: host })

      expect(result).toEqual({
        repaired: 0,
        primitiveRepaired: 0,
        previewMigrated: 0,
        quarantined: 0
      })
    })
  })

  describe('value-widget repair', () => {
    it('alreadyLinked: applies host value to the matching promoted widget', () => {
      const host = buildHost()
      const inner = addInnerNode(host, 'Inner', (n) => {
        n.addWidget('number', 'seed', 0, () => {})
      })
      const handle = addPromotedHostInput(host, {
        inputName: 'seed_link',
        promotedName: 'seed',
        sourceNodeId: String(inner.id),
        sourceWidgetName: 'seed',
        initialValue: 0
      })

      host.properties.proxyWidgets = [[String(inner.id), 'seed']]
      const result = flushProxyWidgetMigration({
        hostNode: host,
        hostWidgetValues: [99]
      })

      expect(result).toMatchObject({ repaired: 1, quarantined: 0 })
      expect(handle.getValue()).toBe(99)
      expect(host.properties.proxyWidgets).toBeUndefined()
    })

    it('alreadyLinked: hydrates real promoted widget without mutating the interior widget', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'seed', type: 'INT' }]
      })
      const host = createTestSubgraphNode(subgraph)
      host.graph!.add(host)
      const inner = addInnerNode(host, 'Inner', (n) => {
        const slot = n.addInput('seed', 'INT')
        const innerWidget = n.addWidget('number', 'seed', 0, () => {})
        slot.widget = { name: innerWidget.name }
      })
      subgraph.inputNode.slots[0].connect(inner.inputs[0], inner)

      host.properties.proxyWidgets = [[String(inner.id), 'seed']]
      const result = flushProxyWidgetMigration({
        hostNode: host,
        hostWidgetValues: [99]
      })

      expect(result).toMatchObject({ repaired: 1, quarantined: 0 })
      expect(host.widgets[0].value).toBe(99)
      const innerWidget = inner.widgets!.find((w) => w.name === 'seed')!
      expect(innerWidget.value).toBe(0)
    })

    it('alreadyLinked: leaves widget value unchanged when host value is a sparse hole', () => {
      const host = buildHost()
      const inner = addInnerNode(host, 'Inner', (n) => {
        n.addWidget('number', 'seed', 0, () => {})
      })
      const handle = addPromotedHostInput(host, {
        inputName: 'seed_link',
        promotedName: 'seed',
        sourceNodeId: String(inner.id),
        sourceWidgetName: 'seed',
        initialValue: 7
      })

      host.properties.proxyWidgets = [[String(inner.id), 'seed']]
      const sparse: unknown[] = []
      const result = flushProxyWidgetMigration({
        hostNode: host,
        hostWidgetValues: sparse
      })

      expect(result).toMatchObject({ repaired: 1, quarantined: 0 })
      expect(handle.getValue()).toBe(7)
    })

    it('alreadyLinked: ambiguous matching inputs quarantine without applying host value', () => {
      const host = buildHost()
      const inner = addInnerNode(host, 'Inner', (n) => {
        n.addWidget('number', 'seed', 0, () => {})
      })
      const a = addPromotedHostInput(host, {
        inputName: 'first_seed',
        promotedName: 'seed',
        sourceNodeId: String(inner.id),
        sourceWidgetName: 'seed',
        initialValue: 1
      })
      const b = addPromotedHostInput(host, {
        inputName: 'second_seed',
        promotedName: 'seed',
        sourceNodeId: String(inner.id),
        sourceWidgetName: 'seed',
        initialValue: 2
      })

      host.properties.proxyWidgets = [[String(inner.id), 'seed']]
      const result = flushProxyWidgetMigration({
        hostNode: host,
        hostWidgetValues: [99]
      })

      expect(result).toMatchObject({ repaired: 0, quarantined: 1 })
      expect(a.getValue()).toBe(1)
      expect(b.getValue()).toBe(2)
      expect(readHostQuarantine(host)).toEqual([
        expect.objectContaining({
          originalEntry: [String(inner.id), 'seed'],
          reason: 'ambiguousSubgraphInput'
        })
      ])
    })

    it('createSubgraphInput: creates exactly one new SubgraphInput linked to the source widget', () => {
      const host = buildHost()
      const inner = addInnerNode(host, 'Inner', (n) => {
        const slot = n.addInput('seed', 'INT')
        slot.widget = { name: 'seed' }
        n.addWidget('number', 'seed', 0, () => {})
      })

      const inputCountBefore = host.subgraph.inputs.length
      host.properties.proxyWidgets = [[String(inner.id), 'seed']]
      const result = flushProxyWidgetMigration({ hostNode: host })

      expect(result).toMatchObject({ repaired: 1, quarantined: 0 })
      expect(host.subgraph.inputs).toHaveLength(inputCountBefore + 1)
      const created = host.subgraph.inputs.at(-1)
      expect(created?._widget).toBeDefined()
    })

    it('createSubgraphInput: honors disambiguatingSourceNodeId when source widget name has been deduplicated', () => {
      // The host's immediate child (inner) carries promoted widgets that
      // surface two interior "text" widgets, deduplicated to ("text",
      // "text_1") at this level. The legacy proxyWidgets tuple identifies
      // the *second* one via its underlying source-node id ("2"). The
      // migration must pick the widget whose interior identity matches
      // (sourceNodeId="2", sourceWidgetName="text") — i.e. the one renamed
      // to "text_1" — not the lexical first widget called "text".
      const host = buildHost()
      const inner = addInnerNode(host, 'InnerWithDedupedPromotion', (n) => {
        const slot1 = n.addInput('text', 'STRING')
        slot1.widget = { name: 'text' }
        const w1 = n.addWidget('text', 'text', '11111111111', () => {})
        Object.assign(w1, { sourceNodeId: '1', sourceWidgetName: 'text' })

        const slot2 = n.addInput('text_1', 'STRING')
        slot2.widget = { name: 'text_1' }
        const w2 = n.addWidget('text', 'text_1', '22222222222', () => {})
        Object.assign(w2, { sourceNodeId: '2', sourceWidgetName: 'text' })
      })

      host.properties.proxyWidgets = [[String(inner.id), 'text', '2']]
      const result = flushProxyWidgetMigration({ hostNode: host })

      expect(result).toMatchObject({ repaired: 1, quarantined: 0 })
      const created = host.subgraph.inputs.at(-1)
      expect(created?._widget).toBeDefined()
      // The created SubgraphInput connects to inner's "text_1" slot (the
      // disambiguated one), not "text".
      const linkedSlot = inner.inputs.find(
        (slot) => slot.link === created?.linkIds[0]
      )
      expect(linkedSlot?.name).toBe('text_1')
    })

    it('createSubgraphInput: quarantines missingSubgraphInput when source widget has no backing input slot', () => {
      const host = buildHost()
      const inner = addInnerNode(host, 'Inner', (n) => {
        n.addWidget('number', 'seed', 0, () => {})
      })

      const inputCountBefore = host.subgraph.inputs.length
      host.properties.proxyWidgets = [[String(inner.id), 'seed']]
      const result = flushProxyWidgetMigration({ hostNode: host })

      expect(result).toMatchObject({ repaired: 0, quarantined: 1 })
      expect(host.subgraph.inputs).toHaveLength(inputCountBefore)
      expect(readHostQuarantine(host)).toEqual([
        expect.objectContaining({
          originalEntry: [String(inner.id), 'seed'],
          reason: 'missingSubgraphInput'
        })
      ])
    })
  })

  describe('primitive fan-out repair', () => {
    it('repairs 1 primitive fanned out to 3 targets into a single SubgraphInput', () => {
      const host = buildHost()
      const { primitive, targets } = addPrimitiveWithTargets(host, {
        targetCount: 3
      })

      const inputCountBefore = host.subgraph.inputs.length
      host.properties.proxyWidgets = [[String(primitive.id), 'value']]
      const result = flushProxyWidgetMigration({ hostNode: host })

      expect(result).toMatchObject({
        primitiveRepaired: 1,
        repaired: 0,
        quarantined: 0
      })
      expect(host.subgraph.inputs).toHaveLength(inputCountBefore + 1)
      for (const target of targets) {
        const slot = target.inputs[0]
        expect(slot.link).not.toBeNull()
        const link = host.subgraph.links.get(slot.link!)
        expect(link?.origin_id).not.toBe(primitive.id)
      }
    })

    it('coalesces duplicate cohort entries pointing at the same primitive', () => {
      const host = buildHost()
      const { primitive, targets } = addPrimitiveWithTargets(host, {
        targetCount: 2
      })

      host.properties.proxyWidgets = [
        [String(primitive.id), 'value'],
        [String(primitive.id), 'value']
      ]
      const result = flushProxyWidgetMigration({ hostNode: host })

      expect(result).toMatchObject({ primitiveRepaired: 1, quarantined: 0 })
      for (const target of targets) {
        const slot = target.inputs[0]
        const link = host.subgraph.links.get(slot.link!)
        expect(link?.origin_id).not.toBe(primitive.id)
      }
    })

    it('host value wins over primitive widget value', () => {
      const host = buildHost()
      const { primitive } = addPrimitiveWithTargets(host, {
        targetCount: 2,
        primitiveValue: 11
      })

      host.properties.proxyWidgets = [[String(primitive.id), 'value']]
      const result = flushProxyWidgetMigration({
        hostNode: host,
        hostWidgetValues: [123]
      })
      expect(result.primitiveRepaired).toBe(1)

      // Host value lands on the host's input mirror (a `PromotedWidgetView`),
      // not on the shared interior consumer widget. Verifying the host side
      // is what guarantees per-host value independence.
      const hostInput = host.inputs.at(-1)
      expect(hostInput?._widget?.value).toBe(123)
    })

    it('seeds value from the primitive widget when no host value is supplied', () => {
      const host = buildHost()
      const { primitive } = addPrimitiveWithTargets(host, {
        targetCount: 1,
        primitiveValue: 11
      })

      host.properties.proxyWidgets = [[String(primitive.id), 'value']]
      const result = flushProxyWidgetMigration({ hostNode: host })

      expect(result.primitiveRepaired).toBe(1)
      // With no host value supplied, the host is seeded per-instance from
      // the primitive's widget value — never by mutating the shared interior.
      const hostInput = host.inputs.at(-1)
      expect(hostInput?._widget?.value).toBe(11)
    })

    it('quarantines an unlinked primitive node with no fan-out', () => {
      const host = buildHost()
      const primitive = new LGraphNode('Primitive')
      primitive.type = 'PrimitiveNode'
      primitive.addOutput('value', '*')
      host.subgraph.add(primitive)

      host.properties.proxyWidgets = [[String(primitive.id), 'value']]
      const result = flushProxyWidgetMigration({ hostNode: host })

      expect(result).toMatchObject({ primitiveRepaired: 0, quarantined: 1 })
      expect(readHostQuarantine(host)).toEqual([
        expect.objectContaining({
          originalEntry: [String(primitive.id), 'value'],
          reason: 'unlinkedSourceWidget'
        })
      ])
    })

    it('quarantines all cohort entries when a target slot type is incompatible', () => {
      const host = buildHost()
      const { primitive, targets } = addPrimitiveWithTargets(host, {
        targetCount: 1
      })
      targets[0].inputs[0].type = 'STRING'

      const inputCountBefore = host.subgraph.inputs.length
      host.properties.proxyWidgets = [[String(primitive.id), 'value']]
      const result = flushProxyWidgetMigration({ hostNode: host })

      expect(result).toMatchObject({ primitiveRepaired: 0, quarantined: 1 })
      expect(host.subgraph.inputs).toHaveLength(inputCountBefore)
      expect(readHostQuarantine(host)).toEqual([
        expect.objectContaining({
          originalEntry: [String(primitive.id), 'value'],
          reason: 'primitiveBypassFailed'
        })
      ])
    })

    it('keeps surviving primitive targets when one fan-out link is dangling', () => {
      const host = buildHost()
      const { primitive } = addPrimitiveWithTargets(host, { targetCount: 1 })

      const danglingLinkId = 999_999
      expect(host.subgraph.links.has(danglingLinkId)).toBe(false)
      primitive.outputs[0].links = [
        ...(primitive.outputs[0].links ?? []),
        danglingLinkId
      ]

      host.properties.proxyWidgets = [[String(primitive.id), 'value']]
      const result = flushProxyWidgetMigration({ hostNode: host })

      expect(result).toMatchObject({ primitiveRepaired: 0, quarantined: 1 })
      expect(readHostQuarantine(host)).toEqual([
        expect.objectContaining({
          originalEntry: [String(primitive.id), 'value'],
          reason: 'primitiveBypassFailed'
        })
      ])
    })

    it('keeps independent values across two hosts of the same subgraph', () => {
      // Regression for the multi-host primitive bypass bug: each host's
      // per-instance value must land in its own host store, never on the
      // shared interior consumer widget. After both hosts migrate, the
      // first host must still see its own value (not be stomped by the
      // second host) and the second host must successfully bypass even
      // though the primitive's outputs were severed by the first host.
      const subgraph = createTestSubgraph()
      const hostA = createTestSubgraphNode(subgraph)
      const hostB = createTestSubgraphNode(subgraph)
      hostA.graph!.add(hostA)
      hostB.graph!.add(hostB)

      const primitive = new LGraphNode('PrimitiveNode')
      primitive.type = 'PrimitiveNode'
      primitive.addOutput('value', 'INT')
      primitive.addWidget('number', 'value', 0, () => {})
      subgraph.add(primitive)

      const target = new LGraphNode('Target')
      const slot = target.addInput('value', 'INT')
      slot.widget = { name: 'value' }
      target.addWidget('number', 'value', 0, () => {})
      subgraph.add(target)
      primitive.connect(0, target, 0)

      hostA.properties.proxyWidgets = [[String(primitive.id), 'value']]
      hostB.properties.proxyWidgets = [[String(primitive.id), 'value']]

      const resultA = flushProxyWidgetMigration({
        hostNode: hostA,
        hostWidgetValues: [11]
      })
      const resultB = flushProxyWidgetMigration({
        hostNode: hostB,
        hostWidgetValues: [22]
      })

      expect(resultA).toMatchObject({ primitiveRepaired: 1, quarantined: 0 })
      // Host B's classify recognises the bypass marker on the primitive and
      // takes the `alreadyLinked` path, so it counts as `repaired` not
      // `primitiveRepaired`. Either way, no quarantine.
      expect(resultB).toMatchObject({ quarantined: 0 })
      expect(resultB.repaired + resultB.primitiveRepaired).toBe(1)

      const widgetA = hostA.inputs.at(-1)?._widget
      const widgetB = hostB.inputs.at(-1)?._widget
      expect(widgetA?.value).toBe(11)
      expect(widgetB?.value).toBe(22)
    })
  })

  describe('preview exposure migration', () => {
    it('adds an exposure for a $$-prefixed preview source', () => {
      const host = buildHost()
      const inner = addInnerNode(host, 'Inner', (n) => {
        n.addWidget('text', '$$canvas-image-preview', '', () => {})
      })

      host.properties.proxyWidgets = [
        [String(inner.id), '$$canvas-image-preview']
      ]
      const result = flushProxyWidgetMigration({ hostNode: host })

      expect(result).toMatchObject({ previewMigrated: 1, quarantined: 0 })
      const exposures = usePreviewExposureStore().getExposures(
        host.rootGraph.id,
        String(host.id)
      )
      expect(exposures).toHaveLength(1)
      expect(exposures[0].sourcePreviewName).toBe('$$canvas-image-preview')
      expect(exposures[0].sourceNodeId).toBe(String(inner.id))
    })

    it('classifies type:preview serialize:false widgets as preview exposure', () => {
      const host = buildHost()
      const inner = addInnerNode(host, 'Inner', (n) => {
        const widget = n.addWidget('text', 'videopreview', '', () => {})
        widget.type = 'preview'
        widget.serialize = false
      })

      host.properties.proxyWidgets = [[String(inner.id), 'videopreview']]
      const result = flushProxyWidgetMigration({ hostNode: host })

      expect(result).toMatchObject({ previewMigrated: 1, quarantined: 0 })
      const exposures = usePreviewExposureStore().getExposures(
        host.rootGraph.id,
        String(host.id)
      )
      expect(exposures).toEqual([
        expect.objectContaining({
          sourceNodeId: String(inner.id),
          sourcePreviewName: 'videopreview'
        })
      ])
    })

    it('produces a unique name on collision via nextUniqueName', () => {
      const host = buildHost()
      const innerA = addInnerNode(host, 'InnerA', (n) => {
        n.addWidget('text', '$$canvas-image-preview', '', () => {})
      })
      const innerB = addInnerNode(host, 'InnerB', (n) => {
        n.addWidget('text', '$$canvas-image-preview', '', () => {})
      })

      const store = usePreviewExposureStore()
      const locator = String(host.id)
      store.addExposure(host.rootGraph.id, locator, {
        sourceNodeId: String(innerA.id),
        sourcePreviewName: '$$canvas-image-preview'
      })

      host.properties.proxyWidgets = [
        [String(innerB.id), '$$canvas-image-preview']
      ]
      const result = flushProxyWidgetMigration({ hostNode: host })

      expect(result).toMatchObject({ previewMigrated: 1, quarantined: 0 })
      const exposures = store.getExposures(host.rootGraph.id, locator)
      expect(exposures).toHaveLength(2)
      const newExposure = exposures.find(
        (e) => e.sourceNodeId === String(innerB.id)
      )
      expect(newExposure?.name).toBe('$$canvas-image-preview_1')
    })

    it('reuses an existing exposure for the same source preview', () => {
      const host = buildHost()
      const inner = addInnerNode(host, 'Inner', (n) => {
        n.addWidget('text', '$$canvas-image-preview', '', () => {})
      })

      const store = usePreviewExposureStore()
      const locator = String(host.id)
      store.addExposure(host.rootGraph.id, locator, {
        sourceNodeId: String(inner.id),
        sourcePreviewName: '$$canvas-image-preview'
      })

      host.properties.proxyWidgets = [
        [String(inner.id), '$$canvas-image-preview']
      ]
      const result = flushProxyWidgetMigration({ hostNode: host })

      expect(result).toMatchObject({ previewMigrated: 1, quarantined: 0 })
      expect(store.getExposures(host.rootGraph.id, locator)).toHaveLength(1)
    })
  })

  describe('quarantine accumulation', () => {
    it('quarantines entries whose source node has disappeared', () => {
      const host = buildHost()
      host.properties.proxyWidgets = [['9999', 'seed']]

      const result = flushProxyWidgetMigration({ hostNode: host })

      expect(result).toMatchObject({ quarantined: 1 })
      expect(readHostQuarantine(host)).toEqual([
        {
          originalEntry: ['9999', 'seed'],
          reason: 'missingSourceNode',
          attemptedAtVersion: 1
        }
      ])
    })

    it('quarantines entries whose source widget is missing on the source node', () => {
      const host = buildHost()
      const inner = addInnerNode(host, 'Inner')
      host.properties.proxyWidgets = [[String(inner.id), 'nonexistent']]

      const result = flushProxyWidgetMigration({ hostNode: host })

      expect(result).toMatchObject({ quarantined: 1 })
      expect(readHostQuarantine(host)).toEqual([
        expect.objectContaining({
          originalEntry: [String(inner.id), 'nonexistent'],
          reason: 'missingSourceWidget'
        })
      ])
    })

    it('preserves the host value on the quarantine row when one was supplied', () => {
      const host = buildHost()
      host.properties.proxyWidgets = [['9999', 'seed']]

      flushProxyWidgetMigration({
        hostNode: host,
        hostWidgetValues: [42]
      })

      expect(readHostQuarantine(host)).toEqual([
        expect.objectContaining({
          originalEntry: ['9999', 'seed'],
          reason: 'missingSourceNode',
          hostValue: 42
        })
      ])
    })

    it('round-trips appended entries via the public read helper', () => {
      const host = buildHost()
      host.properties.proxyWidgets = [['9999', 'seed']]
      flushProxyWidgetMigration({ hostNode: host })
      const first = readHostQuarantine(host)
      expect(first).toHaveLength(1)

      host.properties.proxyWidgets = [['9999', 'seed', 'inner-leaf']]
      flushProxyWidgetMigration({ hostNode: host })

      const after = readHostQuarantine(host)
      expect(after).toHaveLength(2)
      expect(after.map((e) => e.originalEntry)).toEqual([
        ['9999', 'seed'],
        ['9999', 'seed', 'inner-leaf']
      ])
    })

    it('deduplicates entries with identical originalEntry tuples on re-flush', () => {
      const host = buildHost()
      host.properties.proxyWidgets = [['9999', 'seed']]
      flushProxyWidgetMigration({ hostNode: host })
      const firstQuarantine = readHostQuarantine(host)
      expect(firstQuarantine).toHaveLength(1)

      host.properties.proxyWidgets = [['9999', 'seed']]
      flushProxyWidgetMigration({ hostNode: host })

      expect(readHostQuarantine(host)).toEqual(firstQuarantine)
    })
  })

  describe('idempotency', () => {
    it('clears properties.proxyWidgets after a successful flush', () => {
      const host = buildHost()
      const inner = addInnerNode(host, 'Inner', (n) => {
        n.addWidget('text', '$$canvas-image-preview', '', () => {})
      })
      host.properties.proxyWidgets = [
        [String(inner.id), '$$canvas-image-preview']
      ]

      flushProxyWidgetMigration({ hostNode: host })

      expect(host.properties.proxyWidgets).toBeUndefined()
    })

    it('re-running flush over a fully migrated host produces no further mutations', () => {
      const host = buildHost()
      const inner = addInnerNode(host, 'Inner', (n) => {
        n.addWidget('text', '$$canvas-image-preview', '', () => {})
      })
      host.properties.proxyWidgets = [
        [String(inner.id), '$$canvas-image-preview']
      ]

      const first = flushProxyWidgetMigration({ hostNode: host })
      expect(first.previewMigrated).toBe(1)

      const exposuresAfterFirst = usePreviewExposureStore()
        .getExposures(host.rootGraph.id, String(host.id))
        .map((e) => ({ ...e }))

      const second = flushProxyWidgetMigration({ hostNode: host })

      expect(second).toEqual({
        repaired: 0,
        primitiveRepaired: 0,
        previewMigrated: 0,
        quarantined: 0
      })
      expect(
        usePreviewExposureStore().getExposures(
          host.rootGraph.id,
          String(host.id)
        )
      ).toEqual(exposuresAfterFirst)
    })
  })

  describe('mixed cohort', () => {
    it('migrates a mixed value+preview cohort in one flush, preserving entry order', () => {
      const host = buildHost()
      const inner = addInnerNode(host, 'Inner', (n) => {
        const slot = n.addInput('seed', 'INT')
        slot.widget = { name: 'seed' }
        n.addWidget('number', 'seed', 0, () => {})
        n.addWidget('text', '$$canvas-image-preview', '', () => {})
      })

      const subgraphInputCountBefore = host.subgraph.inputs.length
      host.properties.proxyWidgets = [
        [String(inner.id), 'seed'],
        [String(inner.id), '$$canvas-image-preview']
      ]
      const result = flushProxyWidgetMigration({
        hostNode: host,
        hostWidgetValues: [99]
      })

      expect(result).toMatchObject({
        repaired: 1,
        previewMigrated: 1,
        quarantined: 0
      })
      expect(host.subgraph.inputs).toHaveLength(subgraphInputCountBefore + 1)
      expect(host.subgraph.inputs.find((i) => i.name === 'seed')).toBeDefined()
      const exposures = usePreviewExposureStore().getExposures(
        host.rootGraph.id,
        String(host.id)
      )
      expect(exposures).toHaveLength(1)
      expect(exposures[0].sourcePreviewName).toBe('$$canvas-image-preview')
    })

    it('preserves sparse holes when supplied widgets_values is missing an index', () => {
      const host = buildHost()
      const inner = addInnerNode(host, 'Inner', (n) => {
        const slotA = n.addInput('a', 'INT')
        slotA.widget = { name: 'a' }
        n.addWidget('number', 'a', 0, () => {})
        const slotB = n.addInput('b', 'INT')
        slotB.widget = { name: 'b' }
        n.addWidget('number', 'b', 0, () => {})
      })

      host.properties.proxyWidgets = [
        [String(inner.id), 'a'],
        [String(inner.id), 'b']
      ]
      const sparse: unknown[] = []
      sparse[1] = 'second-value'
      const result = flushProxyWidgetMigration({
        hostNode: host,
        hostWidgetValues: sparse
      })

      expect(result).toMatchObject({ repaired: 2, quarantined: 0 })
      expect(host.subgraph.inputs.find((i) => i.name === 'a')).toBeDefined()
      expect(host.subgraph.inputs.find((i) => i.name === 'b')).toBeDefined()
    })
  })

  describe('integration with LGraph.configure', () => {
    it('runs through LGraph.configure when the migration hook is wired', () => {
      const host = buildHost()
      const inner = addInnerNode(host, 'Inner', (n) => {
        n.addWidget('text', '$$canvas-image-preview', '', () => {})
      })
      host.properties.proxyWidgets = [
        [String(inner.id), '$$canvas-image-preview']
      ]

      const serialized = host.rootGraph.serialize()
      LGraph.proxyWidgetMigrationFlush = (hostNode, nodeData) =>
        flushProxyWidgetMigration({
          hostNode,
          hostWidgetValues: nodeData?.widgets_values
        })

      const reloadedGraph = new LGraph()
      const subgraph = host.subgraph
      const instanceData = host.serialize()
      LiteGraph.registerNodeType(
        subgraph.id,
        class TestSubgraphNode extends SubgraphNode {
          constructor() {
            super(reloadedGraph, subgraph, instanceData)
          }
        }
      )
      try {
        reloadedGraph.configure(serialized)
      } finally {
        LiteGraph.unregisterNodeType(subgraph.id)
      }

      const reloadedHost = reloadedGraph.getNodeById(host.id)
      expect(reloadedHost?.properties.proxyWidgets).toBeUndefined()
      expect(
        usePreviewExposureStore().getExposures(
          host.rootGraph.id,
          String(host.id)
        )
      ).toEqual([
        expect.objectContaining({
          sourceNodeId: String(inner.id),
          sourcePreviewName: '$$canvas-image-preview'
        })
      ])
    })
  })
})
