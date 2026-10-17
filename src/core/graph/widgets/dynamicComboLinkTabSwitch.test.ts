import { describe, expect, test } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'

// https://github.com/Comfy-Org/ComfyUI_frontend/issues/18388
//
// "Resize Image/Mask" reveals its "match" input through a DynamicCombo
// (`resize_type`): the node's default option has no extra sockets, and
// selecting "Match Size" adds a `resize_type.match` socket via
// dynamicComboWidget's updateWidgets(). Switching workflow tabs reconstructs
// the node fresh from its node definition (picking the default option again)
// and then replays the saved widget value through ComfyNode's `configure()`
// override in litegraphService.ts - the same two steps below.
const nodeName = 'TestResizeImageMask'

const nodeDef: ComfyNodeDefV1 = {
  name: nodeName,
  display_name: 'Test Resize Image/Mask',
  category: 'testing',
  python_module: 'nodes',
  description: '',
  input: {
    required: {
      input: ['IMAGE', {}],
      resize_type: [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            {
              key: 'scale_dimensions',
              inputs: {
                required: {
                  width: ['INT', { default: 512 }],
                  height: ['INT', { default: 512 }],
                  crop: [['center', 'disabled'], { default: 'center' }]
                }
              }
            },
            {
              key: 'match_size',
              inputs: {
                required: {
                  match: ['IMAGE', {}],
                  crop: [['center', 'disabled'], { default: 'center' }]
                }
              }
            }
          ]
        }
      ],
      scale_method: [['area', 'bilinear'], { default: 'area' }]
    }
  },
  output: ['IMAGE'],
  output_name: ['resized'],
  output_node: false
}

function findMatchInput(node: LGraphNode) {
  return node.inputs.findIndex((input) => input.name === 'resize_type.match')
}

function createNodeOrThrow(type: string): LGraphNode {
  const node = LiteGraph.createNode(type)
  if (!node) throw new Error(`failed to create node: ${type}`)
  return node
}

function connectOrThrow(
  source: LGraphNode,
  sourceSlot: number,
  target: LGraphNode,
  targetSlot: number
) {
  const link = source.connect(sourceSlot, target, targetSlot)
  if (!link)
    throw new Error(`failed to connect ${source.type} to ${target.type}`)
  return link
}

function getWidgetOrThrow(node: LGraphNode, name: string) {
  const widget = node.widgets?.find((widget) => widget.name === name)
  if (!widget) throw new Error(`widget not found: ${name}`)
  return widget
}

function getNodeByTypeOrThrow(graph: LGraph, type: string): LGraphNode {
  const node = graph.nodes.find((n) => n.type === type)
  if (!node) throw new Error(`node not found: ${type}`)
  return node
}

function getLinkOriginId(node: LGraphNode, slot: number) {
  return node.getInputLink(slot)?.origin_id
}

/** Two distinct, separately-registered IMAGE producers so a crossed or
 * misindexed link (matched by slot index alone) would be caught by comparing
 * `origin_id`, not just presence of a link. */
class TestMatchSourceNode extends LGraphNode {
  static override title = 'Test Match Source'
  constructor() {
    super('Test Match Source')
    this.addOutput('out', 'IMAGE')
  }
}

class TestBaseImageSourceNode extends LGraphNode {
  static override title = 'Test Base Image Source'
  constructor() {
    super('Test Base Image Source')
    this.addOutput('out', 'IMAGE')
  }
}

/** Forces `app.configuringGraph`, as `LGraph.prototype.configure` does for
 * the duration of every real `configure()` call once `app.setup()` has
 * installed its wrapper — never installed in this unit test's isolation.
 * Several dynamic-input paths branch on this flag, so without it the test
 * could exercise different code than a real tab switch does. */
function withConfiguringGraph<T>(fn: () => T): T {
  Object.defineProperty(app, 'configuringGraph', {
    get: () => true,
    configurable: true
  })
  try {
    return fn()
  } finally {
    delete (app as unknown as Record<string, unknown>).configuringGraph
  }
}

describe('DynamicCombo input link survives a workflow tab switch (#18388)', () => {
  test('a link into the "Match Size" option is retained after reconstruction + configure()', async () => {
    await useLitegraphService().registerNodeDef(nodeName, nodeDef)
    LiteGraph.registerNodeType('source', TestMatchSourceNode)
    LiteGraph.registerNodeType('baseImageSource', TestBaseImageSourceNode)

    const graph = new LGraph()
    const resizeNode = createNodeOrThrow(nodeName)
    graph.add(resizeNode)

    const source = createNodeOrThrow('source')
    graph.add(source)

    const baseImageSource = createNodeOrThrow('baseImageSource')
    graph.add(baseImageSource)
    const baseInputIndex = resizeNode.inputs.findIndex(
      (input) => input.name === 'input'
    )
    expect(baseInputIndex).toBeGreaterThanOrEqual(0)
    connectOrThrow(baseImageSource, 0, resizeNode, baseInputIndex)

    const resizeTypeWidget = getWidgetOrThrow(resizeNode, 'resize_type')
    resizeTypeWidget.value = 'match_size'

    const matchIndex = findMatchInput(resizeNode)
    expect(matchIndex).toBeGreaterThanOrEqual(0)
    connectOrThrow(source, 0, resizeNode, matchIndex)
    expect(resizeNode.isInputConnected(matchIndex)).toBe(true)

    // Switching away from this tab and back reconstructs every node fresh
    // from its node definition (defaulting `resize_type` back to
    // "scale_dimensions") and then configures each one with the tab's saved
    // state, exactly what `app.loadGraphData` does via `graph.clear()` +
    // `graph.configure()`. Reverting the production fix does turn this test
    // red again (verified manually), confirming it isn't just observing an
    // intermediate state that `vi.useFakeTimers()` and the missing
    // `app.setup()` hooks happen to leave stable.
    const serialized = graph.serialize()
    graph.clear()
    const configureError = withConfiguringGraph(() =>
      graph.configure(serialized)
    )
    expect(configureError).not.toBe(true)
    expect(graph.nodes.filter((n) => n.has_errors)).toEqual([])

    const reloadedNode = getNodeByTypeOrThrow(graph, nodeName)
    const reloadedBaseIndex = reloadedNode.inputs.findIndex(
      (input) => input.name === 'input'
    )
    expect(reloadedNode.isInputConnected(reloadedBaseIndex)).toBe(true)
    expect(getLinkOriginId(reloadedNode, reloadedBaseIndex)).toBe(
      baseImageSource.id
    )

    const reloadedMatchIndex = findMatchInput(reloadedNode)
    expect(reloadedMatchIndex).toBeGreaterThanOrEqual(0)
    expect(reloadedNode.isInputConnected(reloadedMatchIndex)).toBe(true)
    expect(getLinkOriginId(reloadedNode, reloadedMatchIndex)).toBe(source.id)

    const reloadedResizeTypeWidget = getWidgetOrThrow(
      reloadedNode,
      'resize_type'
    )
    expect(reloadedResizeTypeWidget.value).toBe('match_size')
    expect(
      reloadedNode.inputs.some((input) => input.name === 'resize_type.width')
    ).toBe(false)
  })
})
