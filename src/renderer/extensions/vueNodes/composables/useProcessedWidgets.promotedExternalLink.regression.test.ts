import { beforeEach, describe, expect, it } from 'vitest'

import {
  createTestRootGraph,
  createTestSubgraphData,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type {
  ExportedSubgraphInstance,
  INodeInputSlot,
  LGraph,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import { LGraphNode, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { WidgetUiCallbacks } from '@/renderer/extensions/vueNodes/composables/processedWidgetRenderModel'
import { computeProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import { createPromotedMultilineWidget } from '@/renderer/extensions/vueNodes/widgets/utils/multilineTextarea'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'
import type { WidgetId } from '@/types/widgetId'
import { widgetId } from '@/types/widgetId'

const TEXT_INPUT = 0
const WIDTH_INPUT = 1

const noopUi: WidgetUiCallbacks = {
  getTooltipConfig: () => ({}),
  handleNodeRightClick: () => {}
}

/** Mirrors the app-layer SubgraphNode (litegraphService.registerSubgraphNodeDef). */
class FixtureHostNode extends SubgraphNode {
  protected override createPromotedHostWidget(
    input: INodeInputSlot,
    id: WidgetId,
    sourceWidget: Readonly<IBaseWidget>
  ): IBaseWidget | undefined {
    return createPromotedMultilineWidget({
      subgraphNode: this,
      input,
      widgetId: id,
      sourceWidget
    })
  }
}

/** Mirrors useStringWidget's multiline `customtext` DOM widget. */
function createInteriorTextNode(): LGraphNode {
  const node = new LGraphNode('CLIPTextEncode')
  const input = node.addInput('text', 'STRING')
  input.widget = { name: 'text' }
  const element = document.createElement('textarea')
  node.addDOMWidget('text', 'customtext', element, {
    getValue: () => element.value,
    setValue: (value: string) => {
      element.value = value
    }
  })
  return node
}

function createInteriorLatentNode(): LGraphNode {
  const node = new LGraphNode('EmptyLatentImage')
  const input = node.addInput('width', 'INT')
  input.widget = { name: 'width' }
  node.addWidget('number', 'width', 512, () => {}, {
    min: 16,
    max: 16384,
    step: 8
  })
  return node
}

function createExternalSource(type: string, slotType: string): LGraphNode {
  const node = new LGraphNode(type)
  node.addOutput(slotType, slotType)
  return node
}

interface Fixture {
  rootGraph: LGraph
  subgraph: Subgraph
  host: SubgraphNode
  intSource: LGraphNode
  stringSource: LGraphNode
}

/**
 * The host is constructed with the unassigned id, as LiteGraph.createNode does
 * in the app, so widget resolution runs from onAdded and materializes the
 * promoted textarea as a DOM host widget instead of the store projection.
 */
function createFixture(): Fixture {
  const rootGraph = createTestRootGraph()
  const subgraph = rootGraph.createSubgraph(
    createTestSubgraphData({ name: 'Promoted host' })
  )
  subgraph.addInput('text', 'STRING')
  subgraph.addInput('width', 'INT')
  const textNode = createInteriorTextNode()
  const latentNode = createInteriorLatentNode()
  subgraph.add(textNode)
  subgraph.add(latentNode)
  subgraph.inputNode.slots[TEXT_INPUT].connect(textNode.inputs[0], textNode)
  subgraph.inputNode.slots[WIDTH_INPUT].connect(
    latentNode.inputs[0],
    latentNode
  )

  const instance: ExportedSubgraphInstance = {
    id: UNASSIGNED_NODE_ID,
    type: subgraph.id,
    pos: [400, 100],
    size: [400, 300],
    inputs: [],
    outputs: [],
    properties: {},
    flags: {},
    mode: 0,
    order: 0
  }
  const host = new FixtureHostNode(rootGraph, subgraph, instance)
  rootGraph.add(host)

  const intSource = createExternalSource('PrimitiveInt', 'INT')
  const stringSource = createExternalSource('PrimitiveString', 'STRING')
  rootGraph.add(intSource)
  rootGraph.add(stringSource)

  return { rootGraph, subgraph, host, intSource, stringSource }
}

function hostWidgetId(fixture: Fixture, name: string) {
  return widgetId(fixture.rootGraph.id, fixture.host.id, name)
}

function processHostWidgets(fixture: Fixture) {
  return computeProcessedWidgets({
    nodeData: fixture.host._state,
    graphId: fixture.rootGraph.id,
    showAdvanced: false,
    isGraphReady: true,
    rootGraph: fixture.rootGraph,
    ui: noopUi
  })
}

function processedHostWidget(fixture: Fixture, name: string) {
  const processed = processHostWidgets(fixture).find(
    (widget) => widget.simplified.name === name
  )
  if (!processed) throw new Error(`Expected a processed ${name} widget`)
  return processed
}

beforeEach(() => {
  resetSubgraphFixtureState()
})

describe('promoted widgets with an external parent-graph link', () => {
  it('materializes the promoted text as a DOM host widget and width as a store projection', () => {
    const fixture = createFixture()

    expect(
      fixture.host.widgets.map((widget) => [widget.name, widget.type])
    ).toEqual([
      ['text', 'customtext'],
      ['width', 'number']
    ])
    expect(processHostWidgets(fixture).map((w) => w.visible)).toEqual([
      true,
      true
    ])
  })

  it('renders the promoted width as a socket-only row once an external Int is wired in', () => {
    const fixture = createFixture()

    fixture.intSource.connect(0, fixture.host, WIDTH_INPUT)

    expect(processedHostWidget(fixture, 'width')).toMatchObject({
      visible: false,
      suppressedByConnection: true,
      slotMetadata: { index: WIDTH_INPUT, linked: true, promoted: true }
    })
  })

  it.fails('KNOWN BUG: the promoted text host widget suppression never reaches the widget store', () => {
    const fixture = createFixture()
    const textWidget = fixture.host.widgets.find((w) => w.name === 'text')
    if (!textWidget) throw new Error('Expected the promoted text widget')

    fixture.stringSource.connect(0, fixture.host, TEXT_INPUT)

    expect(textWidget.connectionSuppressed).toBe(true)
    expect(
      useWidgetValueStore().getWidgetVisibility(hostWidgetId(fixture, 'text'))
        ?.suppression.byConnection
    ).toBe(true)
  })

  it.fails('KNOWN BUG: the render model keeps the promoted text control visible while its input is linked', () => {
    const fixture = createFixture()

    fixture.stringSource.connect(0, fixture.host, TEXT_INPUT)

    expect(processedHostWidget(fixture, 'text')).toMatchObject({
      visible: false,
      suppressedByConnection: true
    })
  })
})
