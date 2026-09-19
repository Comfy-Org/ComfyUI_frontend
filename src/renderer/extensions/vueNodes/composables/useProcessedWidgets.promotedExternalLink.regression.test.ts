import { beforeEach, describe, expect, it } from 'vitest'

import {
  createTestRootGraph,
  createTestSubgraphData,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type {
  ExportedSubgraphInstance,
  INodeInputSlot,
  LGraph
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

interface Fixture {
  rootGraph: LGraph
  host: SubgraphNode
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
  const textNode = createInteriorTextNode()
  subgraph.add(textNode)
  subgraph.inputNode.slots[TEXT_INPUT].connect(textNode.inputs[0], textNode)

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

  const stringSource = new LGraphNode('PrimitiveString')
  stringSource.addOutput('STRING', 'STRING')
  rootGraph.add(stringSource)

  return { rootGraph, host, stringSource }
}

function processedTextWidget(fixture: Fixture) {
  const processed = computeProcessedWidgets({
    nodeData: fixture.host._state,
    graphId: fixture.rootGraph.id,
    showAdvanced: false,
    isGraphReady: true,
    rootGraph: fixture.rootGraph,
    ui: noopUi
  }).find((widget) => widget.simplified.name === 'text')
  if (!processed) throw new Error('Expected a processed text widget')
  return processed
}

beforeEach(() => {
  resetSubgraphFixtureState()
})

describe('promoted multiline text widget with an external parent-graph link', () => {
  it('materializes the promoted text as a DOM host widget that renders visible', () => {
    const fixture = createFixture()

    expect(
      fixture.host.widgets.map((widget) => [widget.name, widget.type])
    ).toEqual([['text', 'customtext']])
    expect(processedTextWidget(fixture).visible).toBe(true)
  })

  it('propagates the host widget connection suppression to the widget store', () => {
    const fixture = createFixture()
    const textWidget = fixture.host.widgets.find((w) => w.name === 'text')
    if (!textWidget) throw new Error('Expected the promoted text widget')

    fixture.stringSource.connect(0, fixture.host, TEXT_INPUT)

    expect(textWidget.connectionSuppressed).toBe(true)
    expect(
      useWidgetValueStore().getWidgetVisibility(
        widgetId(fixture.rootGraph.id, fixture.host.id, 'text')
      )?.suppression.byConnection
    ).toBe(true)
  })

  it('hides the text control in the render model while its input is linked', () => {
    const fixture = createFixture()

    fixture.stringSource.connect(0, fixture.host, TEXT_INPUT)

    expect(processedTextWidget(fixture)).toMatchObject({
      visible: false,
      suppressedByConnection: true
    })
  })
})
