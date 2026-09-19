import { beforeEach, describe, expect, it } from 'vitest'

import type { SubgraphEventMap } from '@/lib/litegraph/src/infrastructure/SubgraphEventMap'
import type { SubgraphInputEventMap } from '@/lib/litegraph/src/infrastructure/SubgraphInputEventMap'
import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

import {
  createEventCapture,
  createTestRootGraph,
  createTestSubgraphData,
  createTestSubgraphNode,
  registerTestSubgraphNodeTypes,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

const TEXT_INPUT = 0
const WIDTH_INPUT = 1

interface ExternalLinkFixture {
  rootGraph: LGraph
  subgraph: Subgraph
  host: SubgraphNode
  intSource: LGraphNode
  stringSource: LGraphNode
}

class FixtureTextNode extends LGraphNode {
  constructor() {
    super('CLIPTextEncode')
    const input = this.addInput('text', 'STRING')
    input.widget = { name: 'text' }
    this.addWidget('text', 'text', '', () => {})
  }
}

class FixtureLatentNode extends LGraphNode {
  constructor() {
    super('EmptyLatentImage')
    const input = this.addInput('width', 'INT')
    input.widget = { name: 'width' }
    this.addWidget('number', 'width', 512, () => {}, {
      min: 16,
      max: 16384,
      step: 8
    })
  }
}

class FixtureIntSource extends LGraphNode {
  constructor() {
    super('PrimitiveInt')
    this.addOutput('INT', 'INT')
  }
}

class FixtureStringSource extends LGraphNode {
  constructor() {
    super('PrimitiveString')
    this.addOutput('STRING', 'STRING')
  }
}

const FIXTURE_NODE_TYPES = {
  'Fixture/PromotedExternalLink/CLIPTextEncode': FixtureTextNode,
  'Fixture/PromotedExternalLink/EmptyLatentImage': FixtureLatentNode,
  'Fixture/PromotedExternalLink/PrimitiveInt': FixtureIntSource,
  'Fixture/PromotedExternalLink/PrimitiveString': FixtureStringSource
}

function createFixtureNode(type: keyof typeof FIXTURE_NODE_TYPES): LGraphNode {
  const node = LiteGraph.createNode(type)
  if (!node) throw new Error(`Fixture node type ${type} is not registered`)
  return node
}

/**
 * Parent graph: [PrimitiveInt] [PrimitiveString] [host subgraph node]
 * Subgraph: `text` (STRING) and `width` (INT) boundary inputs promoted from
 * interior widgets, so the host renders a promoted text and width widget.
 */
function createExternalLinkFixture(): ExternalLinkFixture {
  const rootGraph = createTestRootGraph()
  registerTestSubgraphNodeTypes(rootGraph)
  const subgraph = rootGraph.createSubgraph(
    createTestSubgraphData({ name: 'Promoted host' })
  )
  subgraph.addInput('text', 'STRING')
  subgraph.addInput('width', 'INT')
  const textNode = createFixtureNode(
    'Fixture/PromotedExternalLink/CLIPTextEncode'
  )
  const latentNode = createFixtureNode(
    'Fixture/PromotedExternalLink/EmptyLatentImage'
  )
  subgraph.add(textNode)
  subgraph.add(latentNode)
  subgraph.inputNode.slots[TEXT_INPUT].connect(textNode.inputs[0], textNode)
  subgraph.inputNode.slots[WIDTH_INPUT].connect(
    latentNode.inputs[0],
    latentNode
  )

  const host = createTestSubgraphNode(subgraph)
  rootGraph.add(host)

  const intSource = createFixtureNode(
    'Fixture/PromotedExternalLink/PrimitiveInt'
  )
  const stringSource = createFixtureNode(
    'Fixture/PromotedExternalLink/PrimitiveString'
  )
  rootGraph.add(intSource)
  rootGraph.add(stringSource)

  return { rootGraph, subgraph, host, intSource, stringSource }
}

function hostWidgetId(fixture: ExternalLinkFixture, name: string) {
  return widgetId(fixture.rootGraph.id, fixture.host.id, name)
}

function visibilityOf(fixture: ExternalLinkFixture, name: string) {
  const visibility = useWidgetValueStore().getWidgetVisibility(
    hostWidgetId(fixture, name)
  )
  if (!visibility) throw new Error(`Missing visibility for ${name}`)
  return visibility
}

beforeEach(() => {
  resetSubgraphFixtureState()
  for (const [type, nodeClass] of Object.entries(FIXTURE_NODE_TYPES)) {
    LiteGraph.registerNodeType(type, nodeClass)
  }
})

describe('SubgraphNode promoted widget with an external parent-graph link', () => {
  it('registers both promoted widgets before any external link exists', () => {
    const fixture = createExternalLinkFixture()

    expect(fixture.host.widgets.map((widget) => widget.name)).toEqual([
      'text',
      'width'
    ])
    expect(visibilityOf(fixture, 'width').suppression.byConnection).toBe(false)
    expect(visibilityOf(fixture, 'text').suppression.byConnection).toBe(false)
  })

  it('suppresses the promoted width widget by connection while keeping it promoted', () => {
    const fixture = createExternalLinkFixture()

    const link = fixture.intSource.connect(0, fixture.host, WIDTH_INPUT)

    expect(link).not.toBeNull()
    expect(fixture.host.isInputConnected(WIDTH_INPUT)).toBe(true)
    expect(visibilityOf(fixture, 'width').suppression.byConnection).toBe(true)
    expect(fixture.host.inputs[WIDTH_INPUT].widgetId).toBe(
      hostWidgetId(fixture, 'width')
    )
    expect(fixture.host.widgets.map((widget) => widget.name)).toEqual([
      'text',
      'width'
    ])
  })

  it('does not demote the promoted widget when the external link lands (hypothesis B does not fire)', () => {
    const fixture = createExternalLinkFixture()
    const boundaryEvents = createEventCapture<SubgraphInputEventMap>(
      fixture.subgraph.inputNode.slots[WIDTH_INPUT].events,
      ['input-disconnected']
    )
    const subgraphEvents = createEventCapture<SubgraphEventMap>(
      fixture.subgraph.events,
      ['widget-demoted']
    )

    fixture.intSource.connect(0, fixture.host, WIDTH_INPUT)

    expect(boundaryEvents.getEventsByType('input-disconnected')).toEqual([])
    expect(subgraphEvents.getEventsByType('widget-demoted')).toEqual([])
    expect(
      useWidgetValueStore().getWidget(hostWidgetId(fixture, 'width'))
    ).toBeDefined()
    boundaryEvents.cleanup()
    subgraphEvents.cleanup()
  })

  it('lifts the connection suppression once the external link is removed', () => {
    const fixture = createExternalLinkFixture()
    const link = fixture.intSource.connect(0, fixture.host, WIDTH_INPUT)
    if (!link) throw new Error('Expected the external link to connect')

    fixture.host.disconnectInput(WIDTH_INPUT)

    expect(fixture.host.isInputConnected(WIDTH_INPUT)).toBe(false)
    expect(visibilityOf(fixture, 'width').suppression.byConnection).toBe(false)
  })

  it('lifts the connection suppression when an undo-style reload restores the unlinked graph', () => {
    const fixture = createExternalLinkFixture()
    const unlinkedState = fixture.rootGraph.serialize()
    fixture.intSource.connect(0, fixture.host, WIDTH_INPUT)
    expect(visibilityOf(fixture, 'width').suppression.byConnection).toBe(true)

    fixture.rootGraph.configure(unlinkedState)

    const host = fixture.rootGraph.getNodeById(fixture.host.id)
    if (!host?.isSubgraphNode()) throw new Error('Expected the host to reload')
    expect(host.isInputConnected(WIDTH_INPUT)).toBe(false)
    expect(visibilityOf(fixture, 'width').suppression.byConnection).toBe(false)
  })

  it('keeps the connection suppression when a redo-style reload restores the linked graph', () => {
    const fixture = createExternalLinkFixture()
    fixture.intSource.connect(0, fixture.host, WIDTH_INPUT)
    const linkedState = fixture.rootGraph.serialize()
    fixture.host.disconnectInput(WIDTH_INPUT)

    fixture.rootGraph.configure(linkedState)

    const host = fixture.rootGraph.getNodeById(fixture.host.id)
    if (!host?.isSubgraphNode()) throw new Error('Expected the host to reload')
    expect(host.isInputConnected(WIDTH_INPUT)).toBe(true)
    expect(visibilityOf(fixture, 'width').suppression.byConnection).toBe(true)
    expect(host.widgets.map((widget) => widget.name)).toEqual(['text', 'width'])
  })

  it('suppresses the promoted text widget by connection when an external string lands', () => {
    const fixture = createExternalLinkFixture()

    const link = fixture.stringSource.connect(0, fixture.host, TEXT_INPUT)

    expect(link).not.toBeNull()
    expect(visibilityOf(fixture, 'text').suppression.byConnection).toBe(true)
  })
})
