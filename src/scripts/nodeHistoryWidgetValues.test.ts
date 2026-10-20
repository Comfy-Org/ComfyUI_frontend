import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished
} from 'vitest'

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraphData,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { parseFlattenableSubgraphDefinitions } from '@/platform/workflow/core/utils/workflowFlattening'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useBoundingBoxWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useBoundingBoxWidget'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import {
  collectNodeHistoryWidgets,
  nodeHistoryValuesChanged,
  withNodeHistoryValuesFrom
} from './nodeHistoryWidgetValues'

const regionA = { x: 0, y: 0, width: 64, height: 64 }

function boundingBoxesNode(id: number) {
  const node = new LGraphNode('CreateBoundingBoxes')
  node.id = toNodeId(id)
  node.serialize_widgets = true
  node.addWidget('number', 'width', 512, null)
  node.addWidget('boundingboxes', 'bboxes', [], null)
  return node
}

function widgetOf(node: LGraphNode, name: string) {
  const widget = node.widgets?.find((w) => w.name === name)
  if (!widget) throw new Error(`missing widget ${name}`)
  return widget
}

async function snapshot(rootGraph: LGraph): Promise<ComfyWorkflowJSON> {
  const state = await validateComfyWorkflow(rootGraph.serialize(), (error) => {
    throw new Error(error)
  })
  if (!state) throw new Error('invalid workflow')
  return JSON.parse(JSON.stringify(state))
}

function interiorValues(state: ComfyWorkflowJSON, subgraph: Subgraph) {
  return parseFlattenableSubgraphDefinitions(state.definitions?.subgraphs ?? [])
    .find((candidate) => candidate.id === subgraph.id)
    ?.nodes.at(0)?.widgets_values
}

describe('node-history widget values', () => {
  let rootGraph: LGraph
  let subgraph: Subgraph
  let rootNode: LGraphNode
  let interiorNode: LGraphNode

  beforeEach(() => {
    resetSubgraphFixtureState()
    rootGraph = createTestRootGraph()
    subgraph = rootGraph.createSubgraph(createTestSubgraphData())
    rootGraph.add(createTestSubgraphNode(subgraph, { id: 100 }))
    rootNode = boundingBoxesNode(1)
    rootGraph.add(rootNode)
    interiorNode = boundingBoxesNode(2)
    subgraph.add(interiorNode)
  })

  it('collects node-history widgets with their value slots from the root graph and subgraphs', () => {
    expect(collectNodeHistoryWidgets(rootGraph)).toEqual(
      new Map([
        [widgetId(rootGraph.id, toNodeId(1), 'bboxes'), 1],
        [widgetId(subgraph.id, toNodeId(2), 'bboxes'), 1]
      ])
    )
  })

  it.for([
    { mode: 'Vue nodes', vueNodesMode: true, includesFields: true },
    { mode: 'the classic canvas', vueNodesMode: false, includesFields: false }
  ])(
    'collects the fields mirrored by a crop widget in $mode: $includesFields',
    ({ vueNodesMode, includesFields }) => {
      const previous = LiteGraph.vueNodesMode
      LiteGraph.vueNodesMode = vueNodesMode
      onTestFinished(() => {
        LiteGraph.vueNodesMode = previous
      })
      const node = new LGraphNode('ImageCropV2')
      node.id = toNodeId(3)
      rootGraph.add(node)
      useBoundingBoxWidget()(node, {
        type: 'BOUNDING_BOX',
        name: 'crop_region',
        component: 'ImageCrop'
      })

      const collected = collectNodeHistoryWidgets(rootGraph)

      expect(
        collected.get(widgetId(rootGraph.id, toNodeId(3), 'crop_region'))
      ).toBe(0)
      expect(collected.has(widgetId(rootGraph.id, toNodeId(3), 'x'))).toBe(
        includesFields
      )
    }
  )

  it.for([
    { case: 'only the boxes changed', width: 512, expected: [512, [regionA]] },
    { case: 'the node width changed too', width: 1024, expected: [512, []] }
  ])(
    'carries a subgraph interior value when $case',
    async ({ width, expected }) => {
      const target = await snapshot(rootGraph)
      widgetOf(interiorNode, 'bboxes').value = [regionA]
      widgetOf(interiorNode, 'width').value = width
      const source = await snapshot(rootGraph)

      const result = withNodeHistoryValuesFrom(
        target,
        source,
        collectNodeHistoryWidgets(rootGraph),
        rootGraph.id
      )

      expect(interiorValues(result, subgraph)).toEqual(expected)
      expect(interiorValues(target, subgraph)).toEqual([512, []])
    }
  )

  it('carries every node-history widget of a node with several', async () => {
    rootNode.addWidget('boundingboxes', 'more_bboxes', [], null)
    const target = await snapshot(rootGraph)
    widgetOf(rootNode, 'bboxes').value = [regionA]
    widgetOf(rootNode, 'more_bboxes').value = [regionA, regionA]
    const source = await snapshot(rootGraph)

    const result = withNodeHistoryValuesFrom(
      target,
      source,
      collectNodeHistoryWidgets(rootGraph),
      rootGraph.id
    )

    expect(result.nodes.find((node) => node.id === 1)?.widgets_values).toEqual([
      512,
      [regionA],
      [regionA, regionA]
    ])
  })

  it('carries a value into the slot of a widget with an integer-like name', async () => {
    const node = new LGraphNode('CreateBoundingBoxes')
    node.id = toNodeId(3)
    node.serialize_widgets = true
    node.addWidget('number', 'width', 512, null)
    node.addWidget('boundingboxes', '1', [], null)
    rootGraph.add(node)
    const target = await snapshot(rootGraph)
    widgetOf(node, '1').value = [regionA]
    const source = await snapshot(rootGraph)

    const result = withNodeHistoryValuesFrom(
      target,
      source,
      collectNodeHistoryWidgets(rootGraph),
      rootGraph.id
    )

    expect(result.nodes.find((n) => n.id === 3)?.widgets_values).toEqual([
      512,
      [regionA]
    ])
  })

  it('leaves a node untouched when its positional values do not line up with the named ones', async () => {
    const target = await snapshot(rootGraph)
    const misaligned = target.nodes.find((node) => node.id === 1)
    assert.exists(misaligned)
    misaligned.widgets_values = [512, [], 'appended by an extension']
    widgetOf(rootNode, 'bboxes').value = [regionA]
    const source = await snapshot(rootGraph)

    expect(
      withNodeHistoryValuesFrom(
        target,
        source,
        collectNodeHistoryWidgets(rootGraph),
        rootGraph.id
      )
    ).toEqual(target)
  })

  it.for([
    {
      case: 'a node-history value changed',
      widget: 'bboxes',
      value: [regionA],
      changed: true
    },
    {
      case: 'only another widget changed',
      widget: 'width',
      value: 1024,
      changed: false
    }
  ])('reports $changed when $case', async ({ widget, value, changed }) => {
    const previous = await snapshot(rootGraph)
    widgetOf(interiorNode, widget).value = value
    const current = await snapshot(rootGraph)

    expect(
      nodeHistoryValuesChanged(
        previous,
        current,
        collectNodeHistoryWidgets(rootGraph),
        rootGraph.id
      )
    ).toBe(changed)
  })

  it('leaves the target untouched when the node is gone from the source', async () => {
    const target = await snapshot(rootGraph)
    widgetOf(rootNode, 'bboxes').value = [regionA]
    const widgets = collectNodeHistoryWidgets(rootGraph)
    rootGraph.remove(rootNode)
    const source = await snapshot(rootGraph)

    expect(
      withNodeHistoryValuesFrom(target, source, widgets, rootGraph.id)
    ).toEqual(target)
  })
})
