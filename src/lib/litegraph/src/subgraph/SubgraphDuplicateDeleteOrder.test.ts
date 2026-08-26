import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import type {
  ExportedSubgraphInstance,
  LGraph,
  LLink,
  Reroute,
  Subgraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import {
  LGraphNode as LGraphNodeClass,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import {
  createTestRootGraph,
  createTestSubgraphData,
  registerTestSubgraphNodeTypes,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

const PROMOTED_INPUT = 'value'
const EXTERNAL_INPUT = 'signal'
const CONVERTIBLE_NODE_TYPE = 'test/convertible-promoted-widget'

function addInteriorNodes(definition: Subgraph) {
  const withWidget = new LGraphNodeClass('Interior')
  const promotedTarget = withWidget.addInput(PROMOTED_INPUT, 'number')
  withWidget.addOutput('out', 'number')
  withWidget.addWidget('number', PROMOTED_INPUT, 0, () => {})
  promotedTarget.widget = { name: PROMOTED_INPUT }
  definition.add(withWidget)
  definition.inputNode.slots[0].connect(promotedTarget, withWidget)

  const withoutWidget = new LGraphNodeClass('Sink')
  const externalTarget = withoutWidget.addInput(EXTERNAL_INPUT, 'number')
  definition.add(withoutWidget)
  definition.inputNode.slots[1].connect(externalTarget, withoutWidget)
}

function createSharedDefinition(rootGraph: LGraph): Subgraph {
  const definition = rootGraph.createSubgraph(
    createTestSubgraphData({ name: 'Shared' })
  )
  definition.addInput(PROMOTED_INPUT, 'number')
  definition.addInput(EXTERNAL_INPUT, 'number')
  addInteriorNodes(definition)
  return definition
}

function instantiate(
  definition: Subgraph,
  parent: LGraph | Subgraph,
  promotedValue: number
): SubgraphNode {
  const node = LiteGraph.createNode(definition.id)
  if (!node?.isSubgraphNode()) throw new Error('expected a SubgraphNode')
  parent.add(node)
  const instanceData: ExportedSubgraphInstance = {
    id: node.id,
    type: definition.id,
    pos: [0, 0],
    size: [100, 100],
    inputs: [],
    outputs: [],
    properties: {},
    flags: {},
    mode: 0,
    order: 0,
    widgets_values: [promotedValue]
  }
  node.configure(instanceData)
  return node
}

function promotedValueOf(node: SubgraphNode): unknown {
  const id = promotedId(node)
  return id ? useWidgetValueStore().getWidget(id)?.value : undefined
}

function promotedId(node: SubgraphNode) {
  return node.inputs.find((input) => input.name === PROMOTED_INPUT)?.widgetId
}

function convertPromotedWidgetNode(rootGraph: LGraph): SubgraphNode {
  const producer = createTestNode(rootGraph, [], ['number'])

  if (!LiteGraph.registered_node_types[CONVERTIBLE_NODE_TYPE]) {
    class ConvertibleNode extends LGraphNodeClass {
      constructor() {
        super('Convertible')
        const input = this.addInput(PROMOTED_INPUT, 'number')
        input.widget = { name: PROMOTED_INPUT }
        this.addWidget('number', PROMOTED_INPUT, 0, () => {})
      }
    }
    LiteGraph.registered_node_types[CONVERTIBLE_NODE_TYPE] = ConvertibleNode
    onTestFinished(() => {
      if (
        LiteGraph.registered_node_types[CONVERTIBLE_NODE_TYPE] ===
        ConvertibleNode
      ) {
        delete LiteGraph.registered_node_types[CONVERTIBLE_NODE_TYPE]
      }
    })
  }

  const node = LiteGraph.createNode(CONVERTIBLE_NODE_TYPE)
  if (!node) throw new Error('expected a convertible node')
  rootGraph.add(node)

  if (!producer.connect(0, node, 0)) throw new Error('expected an input link')
  const result = rootGraph.convertToSubgraph(new Set([node]))
  assert(result.kind === 'success')
  return result.value.node
}

interface DuplicatedSubgraphScenario {
  rootGraph: LGraph
  definition: Subgraph
  producer: LGraphNodeClass
  instances: [SubgraphNode, SubgraphNode]
  links: [LLink, LLink]
  reroutes: [Reroute, Reroute]
}

function buildScenario(): DuplicatedSubgraphScenario {
  const rootGraph = createTestRootGraph()
  registerTestSubgraphNodeTypes(rootGraph)
  const definition = createSharedDefinition(rootGraph)

  const original = instantiate(definition, rootGraph, 111)
  const copy = instantiate(definition, rootGraph, 222)

  const producer = new LGraphNodeClass('Producer')
  producer.addOutput('out', 'number')
  rootGraph.add(producer)

  const externalSlot = (node: SubgraphNode) =>
    node.inputs.findIndex((input) => input.name === EXTERNAL_INPUT)

  const connect = (target: SubgraphNode): [LLink, Reroute] => {
    const link = producer.connect(0, target, externalSlot(target))
    if (!link) throw new Error('expected an external link')
    const reroute = rootGraph.createReroute([50, 50], link)
    if (!reroute) throw new Error('expected a reroute')
    return [link, reroute]
  }

  const [originalLink, originalReroute] = connect(original)
  const [copyLink, copyReroute] = connect(copy)

  return {
    rootGraph,
    definition,
    producer,
    instances: [original, copy],
    links: [originalLink, copyLink],
    reroutes: [originalReroute, copyReroute]
  }
}

function expectSurvivorUndamaged(
  scenario: DuplicatedSubgraphScenario,
  removeFirst: 0 | 1
) {
  const { rootGraph, definition, producer } = scenario
  const survivorIndex = removeFirst === 0 ? 1 : 0
  const removed = scenario.instances[removeFirst]
  const survivor = scenario.instances[survivorIndex]
  const survivorLink = scenario.links[survivorIndex]
  const survivorReroute = scenario.reroutes[survivorIndex]
  const survivorValue = promotedValueOf(survivor)
  const survivorWidgetId = survivor.inputs.find(
    (input) => input.name === PROMOTED_INPUT
  )?.widgetId

  rootGraph.remove(removed)

  expect(survivorWidgetId).not.toBe(
    removed.inputs.find((input) => input.name === PROMOTED_INPUT)?.widgetId
  )
  expect(promotedValueOf(survivor)).toBe(survivorValue)

  const liveLink = rootGraph.links.get(survivorLink.id)
  expect(liveLink?.origin_id).toBe(producer.id)
  expect(liveLink?.target_id).toBe(survivor.id)
  expect(liveLink?.parentId).toBe(survivorReroute.id)
  expect([
    ...(rootGraph.reroutes.get(survivorReroute.id)?.linkIds ?? [])
  ]).toContain(survivorLink.id)

  expect(rootGraph.subgraphs.get(definition.id)).toBe(definition)

  rootGraph.remove(survivor)
  expect(rootGraph.subgraphs.has(definition.id)).toBe(false)
}

describe('duplicated subgraph deleted in both orders (I4)', () => {
  beforeEach(() => {
    resetSubgraphFixtureState()
  })

  it('deleting the original leaves the copy addressing its own state', () => {
    expectSurvivorUndamaged(buildScenario(), 0)
  })

  it('deleting the copy leaves the original addressing its own state', () => {
    expectSurvivorUndamaged(buildScenario(), 1)
  })

  it('releases promoted widget state when an instance is removed', () => {
    const scenario = buildScenario()
    const removed = scenario.instances[0]
    const removedWidgetId = promotedId(removed)

    scenario.rootGraph.remove(removed)

    expect(
      removedWidgetId && useWidgetValueStore().getWidget(removedWidgetId)
    ).toBeUndefined()
  })

  it('gives converted subgraphs independent promoted widgets (#15565)', () => {
    const rootGraph = createTestRootGraph()
    registerTestSubgraphNodeTypes(rootGraph)
    const first = convertPromotedWidgetNode(rootGraph)
    const second = convertPromotedWidgetNode(rootGraph)

    expect(first.id).not.toBe(second.id)
    expect(promotedId(first)).not.toBe(promotedId(second))
    expect(
      useWidgetValueStore().getWidget(
        widgetId(rootGraph.id, UNASSIGNED_NODE_ID, PROMOTED_INPUT)
      )
    ).toBeUndefined()

    const id = promotedId(first)
    if (!id) throw new Error('expected a promoted widget id')
    const before = promotedValueOf(second)
    expect(useWidgetValueStore().setValue(id, 999)).toBe(true)
    expect(promotedValueOf(first)).toBe(999)
    expect(promotedValueOf(second)).toBe(before)
  })

  it('keeps the shared definition only while a nested instance references it', () => {
    const { rootGraph, definition, instances } = buildScenario()
    const outer = rootGraph.createSubgraph(
      createTestSubgraphData({ name: 'Outer' })
    )
    const outerHost = LiteGraph.createNode(outer.id)
    if (!outerHost?.isSubgraphNode()) throw new Error('expected a SubgraphNode')
    rootGraph.add(outerHost)
    const nested = instantiate(definition, outer, 333)
    const nestedWidgetId = promotedId(nested)

    for (const instance of instances) rootGraph.remove(instance)

    expect(rootGraph.subgraphs.get(definition.id)).toBe(definition)

    rootGraph.remove(outerHost)
    expect(rootGraph.subgraphs.has(outer.id)).toBe(false)
    expect(rootGraph.subgraphs.has(definition.id)).toBe(false)
    expect(
      nestedWidgetId && useWidgetValueStore().getWidget(nestedWidgetId)
    ).toBeUndefined()
  })
})
