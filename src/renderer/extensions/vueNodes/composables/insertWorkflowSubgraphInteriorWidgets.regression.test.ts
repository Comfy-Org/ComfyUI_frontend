import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type {
  InsertWorkflowOp,
  WidgetCatalog
} from '@comfyorg/comfy-multi-player'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished
} from 'vitest'
import * as Y from 'yjs'

import {
  LGraph,
  LGraphNode,
  LiteGraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  enableSubgraphNodeCreation
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'
import { inertPlacementPort } from '@/workbench/extensions/agent/crdt/__fixtures__/inertPlacementPort'
import { AgentCrdtProjection } from '@/workbench/extensions/agent/crdt/agentCrdtProjection'
import { FollowerDoc } from '@/workbench/extensions/agent/crdt/followerDoc'
import { createGraphMutations } from '@/workbench/extensions/agent/crdt/graphMutations'

import type { WidgetUiCallbacks } from './processedWidgetRenderModel'
import { computeProcessedWidgets } from './useProcessedWidgets'

class InteriorWidgetNode extends LGraphNode {
  constructor() {
    super('interior-widget')
    this.serialize_widgets = true
    this.addWidget('text', 'prompt', 'before insert', () => {})
  }
}

/**
 * Real node shapes below are lifted verbatim (type, widget names, and
 * default `widgets_values_named`) from Jo Zhang's nightly CRDT debug
 * captures of five distinct production templates hitting this exact
 * insert_workflow-subgraph-interior-widget bug -- see each `describe`
 * block below for which report and subgraph definition id it reproduces.
 * A unit test has no backend node-definition catalog to construct a real
 * node from, so these fixture classes stand in for it, the same pattern
 * `subgraphHelpers.ts`'s `FixtureStringConcatenateNode` uses.
 */
class RealCLIPTextEncodeNode extends LGraphNode {
  constructor() {
    super('CLIPTextEncode')
    this.serialize_widgets = true
    this.addWidget('text', 'text', '', () => {})
  }
}

class RealEmptySD3LatentImageNode extends LGraphNode {
  constructor() {
    super('EmptySD3LatentImage')
    this.serialize_widgets = true
    this.addWidget('number', 'width', 1024, () => {})
    this.addWidget('number', 'height', 1024, () => {})
    this.addWidget('number', 'batch_size', 1, () => {})
  }
}

class RealKSamplerNode extends LGraphNode {
  constructor() {
    super('KSampler')
    this.serialize_widgets = true
    this.addWidget('number', 'seed', 0, () => {})
    this.addWidget('combo', 'control_after_generate', 'randomize', () => {}, {
      values: ['fixed', 'increment', 'decrement', 'randomize']
    })
    this.addWidget('number', 'steps', 8, () => {})
    this.addWidget('number', 'cfg', 1, () => {}, { precision: 1 })
    this.addWidget('combo', 'sampler_name', 'res_multistep', () => {}, {
      values: ['res_multistep', 'euler', 'dpmpp_2m']
    })
    this.addWidget('combo', 'scheduler', 'simple', () => {}, {
      values: ['simple', 'normal', 'karras']
    })
    this.addWidget('number', 'denoise', 1, () => {}, { precision: 2 })
  }
}

class RealEmptyLatentImageNode extends LGraphNode {
  constructor() {
    super('EmptyLatentImage')
    this.serialize_widgets = true
    this.addWidget('number', 'width', 1024, () => {})
    this.addWidget('number', 'height', 1024, () => {})
    this.addWidget('number', 'batch_size', 1, () => {})
  }
}

class RealTextEncodeQwenImage21Node extends LGraphNode {
  constructor() {
    super('TextEncodeQwenImage21')
    this.serialize_widgets = true
    this.addWidget('text', 'prompt', '', () => {})
    this.addWidget('text', 'negative_prompt', '', () => {})
    this.addWidget('number', 'resolution', 1024, () => {})
  }
}

class RealMiniMaxH3ImageToVideoNode extends LGraphNode {
  constructor() {
    super('MiniMaxH3ImageToVideo')
    this.serialize_widgets = true
    this.addWidget('text', 'prompt', '', () => {})
    this.addWidget('number', 'width', 1344, () => {})
    this.addWidget('number', 'height', 768, () => {})
    this.addWidget('number', 'length', 73, () => {})
  }
}

class RealStringConcatenateNode extends LGraphNode {
  constructor() {
    super('StringConcatenate')
    this.serialize_widgets = true
    this.addWidget('text', 'string_a', '', () => {})
    this.addWidget('text', 'string_b', '', () => {})
    this.addWidget('text', 'delimiter', '', () => {})
  }
}

class RealPrimitiveStringMultilineNode extends LGraphNode {
  constructor() {
    super('PrimitiveStringMultiline')
    this.serialize_widgets = true
    this.addWidget('text', 'value', '', () => {})
  }
}

class RealPrimitiveBooleanNode extends LGraphNode {
  constructor() {
    super('PrimitiveBoolean')
    this.serialize_widgets = true
    this.addWidget('toggle', 'value', false, () => {})
  }
}

class RealComfyMathExpressionNode extends LGraphNode {
  constructor() {
    super('ComfyMathExpression')
    this.serialize_widgets = true
    this.addWidget('text', 'expression', '', () => {})
  }
}

const catalog: WidgetCatalog = {
  types: {
    'interior-widget': { widget_order: ['prompt'] },
    CLIPTextEncode: { widget_order: ['text'] },
    EmptySD3LatentImage: { widget_order: ['width', 'height', 'batch_size'] },
    KSampler: {
      widget_order: [
        'seed',
        'control_after_generate',
        'steps',
        'cfg',
        'sampler_name',
        'scheduler',
        'denoise'
      ]
    },
    EmptyLatentImage: { widget_order: ['width', 'height', 'batch_size'] },
    TextEncodeQwenImage21: {
      widget_order: ['prompt', 'negative_prompt', 'resolution']
    },
    MiniMaxH3ImageToVideo: {
      widget_order: ['prompt', 'width', 'height', 'length']
    },
    StringConcatenate: {
      widget_order: ['string_a', 'string_b', 'delimiter']
    },
    PrimitiveStringMultiline: { widget_order: ['value'] },
    PrimitiveBoolean: { widget_order: ['value'] },
    ComfyMathExpression: { widget_order: ['expression'] }
  }
}

const noopUi: WidgetUiCallbacks = {
  getTooltipConfig: () => ({}),
  handleNodeRightClick: () => {}
}

beforeEach(() => {
  LiteGraph.registerNodeType('interior-widget', InteriorWidgetNode)
  LiteGraph.registerNodeType('CLIPTextEncode', RealCLIPTextEncodeNode)
  LiteGraph.registerNodeType('EmptySD3LatentImage', RealEmptySD3LatentImageNode)
  LiteGraph.registerNodeType('KSampler', RealKSamplerNode)
  LiteGraph.registerNodeType('EmptyLatentImage', RealEmptyLatentImageNode)
  LiteGraph.registerNodeType(
    'TextEncodeQwenImage21',
    RealTextEncodeQwenImage21Node
  )
  LiteGraph.registerNodeType(
    'MiniMaxH3ImageToVideo',
    RealMiniMaxH3ImageToVideoNode
  )
  LiteGraph.registerNodeType('StringConcatenate', RealStringConcatenateNode)
  LiteGraph.registerNodeType(
    'PrimitiveStringMultiline',
    RealPrimitiveStringMultilineNode
  )
  LiteGraph.registerNodeType('PrimitiveBoolean', RealPrimitiveBooleanNode)
  LiteGraph.registerNodeType('ComfyMathExpression', RealComfyMathExpressionNode)
})

function bindProjection(workflowId: string, graph: LGraph) {
  const follower = new FollowerDoc()
  const projection = new AgentCrdtProjection(
    createGraphMutations({
      getScope: () => graphScopeOf(graph),
      layout: { createNode: () => {}, deleteNodes: () => {} },
      placement: inertPlacementPort
    }),
    () => graph,
    () => follower.doc
  )
  projection.bind(workflowId, follower)
  onTestFinished(() => {
    projection.destroy()
    follower.destroy()
  })

  let sequence = 0
  return (update: Uint8Array, opIds: string[]) => {
    follower.applyRemoteUpdate(update)
    const committed = projection.applyFrame({
      workflowId,
      seq: ++sequence,
      update,
      actor: 'agent:test',
      opIds
    })
    projection.reconcileLiveGraph(workflowId)
    return committed
  }
}

function serializeWorkflow(graph: LGraph): InsertWorkflowOp['workflow'] {
  return JSON.parse(
    JSON.stringify(graph.serialize())
  ) as InsertWorkflowOp['workflow']
}

it('renders a widget on an inserted subgraph-interior node in Vue mode', () => {
  const graph = new LGraph()
  onTestFinished(enableSubgraphNodeCreation(graph))

  const blueprint = new LGraph()
  const subgraph = createTestSubgraph({ rootGraph: blueprint })
  blueprint.subgraphs.set(subgraph.id, subgraph)

  const interior = LiteGraph.createNode('interior-widget')
  assert(interior)
  interior.id = toNodeId(42)
  subgraph.add(interior)
  assert(interior.widgets?.[0])
  interior.widgets[0].value = 'after insert'
  blueprint.add(createTestSubgraphNode(subgraph, { id: 1 }))

  const hostDoc = mint({ nodes: [], links: [] }, catalog)
  onTestFinished(() => hostDoc.destroy())
  const deliver = bindProjection('inserted-subgraph-widget', graph)
  deliver(Y.encodeStateAsUpdate(hostDoc), [])

  const operation: InsertWorkflowOp = {
    op_id: 'inserted-subgraph-widget-test-0001',
    actor: 'agent:test',
    base_version: 1,
    stamp: [1, 'agent:test'],
    op: 'insert_workflow',
    workflow: serializeWorkflow(blueprint)
  }
  const vector = Y.encodeStateVector(hostDoc)
  expect(applyOps(hostDoc, [operation], catalog).outcomes).toEqual([
    { op_id: operation.op_id, outcome: 'applied' }
  ])
  expect(
    deliver(Y.encodeStateAsUpdate(hostDoc, vector), [operation.op_id])
  ).toBe(true)

  const instance = graph._nodes.find(
    (node): node is SubgraphNode => node instanceof SubgraphNode
  )
  assert(instance)
  const materialized = instance.subgraph._nodes.find(
    (node) => node.type === 'interior-widget'
  )
  assert(materialized)
  expect(String(materialized.id)).toContain(':')

  const rootGraphId = graph.rootGraph.id
  const localNodeId = stripGraphPrefix(String(materialized.id))
  assert(localNodeId)
  const widgetIds = useWidgetValueStore().getNodeWidgetIds(
    rootGraphId,
    localNodeId
  )
  const processed = computeProcessedWidgets({
    nodeData: materialized._state,
    widgetIds,
    graphId: rootGraphId,
    showAdvanced: false,
    isGraphReady: true,
    rootGraph: graph,
    ui: noopUi
  })

  expect(
    processed.map(({ visible, simplified }) => ({
      name: simplified.name,
      value: simplified.value,
      visible
    }))
  ).toEqual([{ name: 'prompt', value: 'after insert', visible: true }])
})

/**
 * Renders `interior` in Vue mode exactly as `LGraphNode.vue` would once its
 * owning graph is the active canvas graph, and returns the one matching
 * processed widget (or `undefined`).
 */
function renderInteriorWidgetInVueMode(
  graph: LGraph,
  interior: LGraphNode,
  widgetName: string
) {
  const rootGraphId = graph.rootGraph.id
  const localNodeId = stripGraphPrefix(String(interior.id))
  assert(localNodeId)
  const widgetIds = useWidgetValueStore().getNodeWidgetIds(
    rootGraphId,
    localNodeId
  )
  const processed = computeProcessedWidgets({
    nodeData: interior._state,
    widgetIds,
    graphId: rootGraphId,
    showAdvanced: false,
    isGraphReady: true,
    rootGraph: graph,
    ui: noopUi
  })
  return processed.find((widget) => widget.simplified.name === widgetName)
}

interface RealNodeSpec {
  type: string
  id: number
  collapsed?: boolean
  /** Overrides for this real node type's default widget values. */
  values?: Record<string, string | number | boolean>
}

let realTemplateSeq = 0

/**
 * Builds a single-level subgraph containing one interior node per entry in
 * `nodeSpecs`, and materializes it into `graph` via a real `insert_workflow`
 * op -- the same pipeline `insertSubgraphWithInteriorWidgets` above drives,
 * generalized to cover the several distinct real template shapes below.
 * Returns the materialized `SubgraphNode` host plus a lookup from node
 * `type` to its materialized interior node.
 */
function insertRealTemplateSubgraph(graph: LGraph, nodeSpecs: RealNodeSpec[]) {
  const blueprint = new LGraph()
  const subgraph = createTestSubgraph({ rootGraph: blueprint })
  blueprint.subgraphs.set(subgraph.id, subgraph)

  for (const spec of nodeSpecs) {
    const node = LiteGraph.createNode(spec.type)
    assert(node)
    node.id = toNodeId(spec.id)
    if (spec.collapsed) node.flags.collapsed = true
    for (const [name, value] of Object.entries(spec.values ?? {})) {
      const widget = node.widgets?.find((w) => w.name === name)
      assert(widget)
      widget.value = value
    }
    subgraph.add(node)
  }
  blueprint.add(createTestSubgraphNode(subgraph, { id: 1 }))

  realTemplateSeq += 1
  const workflow = serializeWorkflow(blueprint)
  const hostDoc = mint({ nodes: [], links: [] }, catalog)
  onTestFinished(() => hostDoc.destroy())
  const deliver = bindProjection(`wf-real-template-${realTemplateSeq}`, graph)
  deliver(Y.encodeStateAsUpdate(hostDoc), [])

  const op: InsertWorkflowOp = {
    op_id: `real-template-${realTemplateSeq}`,
    actor: 'agent:test',
    base_version: 1,
    stamp: [1, 'agent:test'],
    op: 'insert_workflow',
    workflow
  }
  const vector = Y.encodeStateVector(hostDoc)
  expect(applyOps(hostDoc, [op], catalog).outcomes).toEqual([
    { op_id: op.op_id, outcome: 'applied' }
  ])
  expect(deliver(Y.encodeStateAsUpdate(hostDoc, vector), [op.op_id])).toBe(true)

  const instance = graph._nodes.find(
    (node): node is SubgraphNode => node instanceof SubgraphNode
  )
  assert(instance)

  const findInterior = (type: string) => {
    const node = instance.subgraph._nodes.find((n) => n.type === type)
    assert(node)
    return node
  }
  return { instance, findInterior }
}

describe('insert_workflow subgraph-interior widgets render in Vue mode (real production captures)', () => {
  /**
   * `jo-zhang-crdt-debug-report-1.md`: "Text to Image (Z-Image-Turbo)"
   * template, subgraph definition id
   * `f2fdebf6-dfaf-43b6-9eb2-7f70613cfdc1`. Node ids and widget values
   * (including the real prompt text) match the capture exactly.
   */
  describe('real "Text to Image (Z-Image-Turbo)" template (report 1)', () => {
    const ZIMAGE_PROMPT =
      'Latina female with thick wavy hair, harbor boats and pastel houses behind. Breezy seaside light, warm tones, cinematic close-up. '

    function insertZImageTurboSubgraph(graph: LGraph) {
      return insertRealTemplateSubgraph(graph, [
        { type: 'CLIPTextEncode', id: 27, values: { text: ZIMAGE_PROMPT } },
        {
          type: 'EmptySD3LatentImage',
          id: 13,
          values: { width: 1024, height: 1024, batch_size: 1 }
        },
        {
          type: 'KSampler',
          id: 3,
          values: {
            seed: 0,
            control_after_generate: 'randomize',
            steps: 8,
            cfg: 1,
            sampler_name: 'res_multistep',
            scheduler: 'simple',
            denoise: 1
          }
        }
      ])
    }

    it.for([
      ['CLIPTextEncode', 'text', ZIMAGE_PROMPT],
      ['EmptySD3LatentImage', 'width', 1024],
      ['EmptySD3LatentImage', 'height', 1024],
      ['EmptySD3LatentImage', 'batch_size', 1],
      ['KSampler', 'seed', 0],
      ['KSampler', 'control_after_generate', 'randomize'],
      ['KSampler', 'steps', 8],
      ['KSampler', 'cfg', 1],
      ['KSampler', 'sampler_name', 'res_multistep'],
      ['KSampler', 'scheduler', 'simple'],
      ['KSampler', 'denoise', 1]
    ] as const)(
      "renders %s interior node's %s widget in Vue mode (%s)",
      ([nodeType, widgetName, expectedValue]) => {
        const graph = new LGraph()
        onTestFinished(enableSubgraphNodeCreation(graph))

        const { findInterior } = insertZImageTurboSubgraph(graph)
        const interior = findInterior(nodeType)
        const liveWidget = interior.widgets?.find((w) => w.name === widgetName)
        expect(liveWidget?.value).toBe(expectedValue)

        const rendered = renderInteriorWidgetInVueMode(
          graph,
          interior,
          widgetName
        )
        expect(rendered).toBeDefined()
        expect(rendered?.visible).toBe(true)
        expect(rendered?.simplified.value).toBe(expectedValue)
      }
    )
  })

  /**
   * `jo-zhang-crdt-debug-report-4.md`: "Text to Image (Qwen Image 2.1)"
   * template, subgraph definition id
   * `c291ceec-b98f-4751-9d0b-7bc288f27b30`. `TextEncodeQwenImage21` is a
   * distinct node shape from report 1's `CLIPTextEncode` -- two string
   * widgets (`prompt`, `negative_prompt`) plus a `resolution` int on ONE
   * node, rather than a separate encode/latent-size node pair. The real
   * capture's `KSampler` also differs from report 1's (fixed/25/euler
   * rather than randomize/8/res_multistep), confirming the fix isn't
   * accidentally tied to one specific widget value.
   */
  describe('real "Text to Image (Qwen Image 2.1)" template (report 4)', () => {
    function insertQwenImageSubgraph(graph: LGraph) {
      return insertRealTemplateSubgraph(graph, [
        {
          type: 'TextEncodeQwenImage21',
          id: 452,
          values: { prompt: '', negative_prompt: '', resolution: 1024 }
        },
        {
          type: 'EmptyLatentImage',
          id: 456,
          values: { width: 1024, height: 1024, batch_size: 1 }
        },
        {
          type: 'KSampler',
          id: 458,
          values: {
            seed: 0,
            control_after_generate: 'fixed',
            steps: 25,
            cfg: 1,
            sampler_name: 'euler',
            scheduler: 'simple',
            denoise: 1
          }
        }
      ])
    }

    it.for([
      ['TextEncodeQwenImage21', 'prompt', ''],
      ['TextEncodeQwenImage21', 'negative_prompt', ''],
      ['TextEncodeQwenImage21', 'resolution', 1024],
      ['KSampler', 'control_after_generate', 'fixed'],
      ['KSampler', 'steps', 25],
      ['KSampler', 'sampler_name', 'euler']
    ] as const)(
      "renders %s interior node's %s widget in Vue mode (%s)",
      ([nodeType, widgetName, expectedValue]) => {
        const graph = new LGraph()
        onTestFinished(enableSubgraphNodeCreation(graph))

        const { findInterior } = insertQwenImageSubgraph(graph)
        const interior = findInterior(nodeType)
        const liveWidget = interior.widgets?.find((w) => w.name === widgetName)
        expect(liveWidget?.value).toBe(expectedValue)

        const rendered = renderInteriorWidgetInVueMode(
          graph,
          interior,
          widgetName
        )
        expect(rendered).toBeDefined()
        expect(rendered?.visible).toBe(true)
        expect(rendered?.simplified.value).toBe(expectedValue)
      }
    )
  })

  /**
   * `jo-zhang-crdt-debug-report-2-entered-subgraph.md`: "Image to Video
   * (MiniMax H3)" template, subgraph definition id
   * `79dd8a95-ce9d-4c14-b264-2162e8bec5ce`. Covers an entirely different
   * media category (video generation, not text-to-image) and a node whose
   * `prompt` widget holds a long multi-paragraph real production prompt
   * rather than a short caption.
   */
  describe('real "Image to Video (MiniMax H3)" template (report 2)', () => {
    const MINIMAX_PROMPT =
      'Vaporwave title sequence look: pink and blue gradient palette, VHS tracking artifacts, Greek statue motifs, chrome palm trees, RGB chromatic aberration, lo-fi retro atmosphere, mood languid and nostalgic.\n\nTimeline:\n[0s-1s] VHS static opens the frame, the title "COMFYUI" appears with RGB split and a slight horizontal jitter.\n[1s-2.5s] Hard cut, a Greek plaster bust close-up, pink-purple gradient sky, a pixelated sun.\n[2.5s-4s] Clean "STARRING" credits appear, "LATENT" and "CONTROLNET" each shown exactly once.\n[4s-5s] Final card "DIRECTED BY COMFYUI" holds, one VHS tracking glitch settling into stability.\n\nHard cuts only, transitions landing with tape jumps, no push-ins, no dissolves.\n\nAudio: lo-fi vaporwave score, slow drum machine with soft bass, VHS tape-noise sample joins at 2.5s, melody fading for the last 1s.\n\nAll text must be clearly legible, do not misspell English, no Chinese characters, do not repeat names or job titles, no soft dissolves, no subtitle bars.'

    function insertMiniMaxSubgraph(graph: LGraph) {
      return insertRealTemplateSubgraph(graph, [
        {
          type: 'MiniMaxH3ImageToVideo',
          id: 131,
          values: {
            prompt: MINIMAX_PROMPT,
            width: 1344,
            height: 768,
            length: 73
          }
        }
      ])
    }

    it.for([
      ['prompt', MINIMAX_PROMPT],
      ['width', 1344],
      ['height', 768],
      ['length', 73]
    ] as const)(
      "renders MiniMaxH3ImageToVideo interior node's %s widget in Vue mode",
      ([widgetName, expectedValue]) => {
        const graph = new LGraph()
        onTestFinished(enableSubgraphNodeCreation(graph))

        const { findInterior } = insertMiniMaxSubgraph(graph)
        const interior = findInterior('MiniMaxH3ImageToVideo')
        const liveWidget = interior.widgets?.find((w) => w.name === widgetName)
        expect(liveWidget?.value).toBe(expectedValue)

        const rendered = renderInteriorWidgetInVueMode(
          graph,
          interior,
          widgetName
        )
        expect(rendered).toBeDefined()
        expect(rendered?.visible).toBe(true)
        expect(rendered?.simplified.value).toBe(expectedValue)
      }
    )
  })

  /**
   * `jo-zhang-crdt-debug-report-3.md`: "Text to Image (Krea-2 Turbo)"
   * template's prompt-styling sub-tooling, originally inserted from a
   * subgraph definition id `b0e5ca93-2731-42b9-8e0a-d28ea851ff81` (visible
   * in the compound node-id path the real capture's remap left behind).
   * Node 17 (`StringConcatenate`) carries `"flags": { "collapsed": true }`
   * in the real capture -- a genuinely collapsed interior node in
   * production at the moment the bug reproduced.
   */
  describe('real "Text to Image (Krea-2 Turbo)" prompt-tooling shape, incl. a genuinely collapsed node (report 3)', () => {
    const KREA_USER_PROMPT =
      'Ultra low angle action shot, male soccer player jumping mid-air high kick, clear vivid blue sky background, forced perspective blurry foreground cleat (white & electric yellow), sharp focused upper body, maroon jersey + white shorts, fully outstretched leg striking a standard soccer ball, harsh direct sunlight, heavy dark shadows, stadium poles & treetops at frame bottom, high contrast sports photography, visible coarse film grain, dynamic movement'

    function insertKreaPromptToolingSubgraph(graph: LGraph) {
      return insertRealTemplateSubgraph(graph, [
        {
          type: 'StringConcatenate',
          id: 17,
          collapsed: true,
          values: { string_a: '', string_b: '', delimiter: '' }
        },
        {
          type: 'PrimitiveStringMultiline',
          id: 19,
          values: { value: KREA_USER_PROMPT }
        },
        { type: 'PrimitiveBoolean', id: 24, values: { value: true } }
      ])
    }

    it.for([
      ['PrimitiveStringMultiline', 'value', KREA_USER_PROMPT],
      ['PrimitiveBoolean', 'value', true],
      ['StringConcatenate', 'string_a', ''],
      ['StringConcatenate', 'string_b', ''],
      ['StringConcatenate', 'delimiter', '']
    ] as const)(
      "renders %s interior node's %s widget in Vue mode",
      ([nodeType, widgetName, expectedValue]) => {
        const graph = new LGraph()
        onTestFinished(enableSubgraphNodeCreation(graph))

        const { findInterior } = insertKreaPromptToolingSubgraph(graph)
        const interior = findInterior(nodeType)
        const liveWidget = interior.widgets?.find((w) => w.name === widgetName)
        expect(liveWidget?.value).toBe(expectedValue)

        const rendered = renderInteriorWidgetInVueMode(
          graph,
          interior,
          widgetName
        )
        expect(rendered).toBeDefined()
        expect(rendered?.visible).toBe(true)
        expect(rendered?.simplified.value).toBe(expectedValue)
      }
    )

    it('renders the widgets of the node that is itself flagged collapsed in the real capture', () => {
      const graph = new LGraph()
      onTestFinished(enableSubgraphNodeCreation(graph))

      const { findInterior } = insertKreaPromptToolingSubgraph(graph)
      const concatenate = findInterior('StringConcatenate')
      expect(concatenate.flags.collapsed).toBe(true)

      const rendered = renderInteriorWidgetInVueMode(
        graph,
        concatenate,
        'string_a'
      )
      expect(rendered).toBeDefined()
      expect(rendered?.visible).toBe(true)
    })
  })

  /**
   * `jo-zhang-crdt-debug-report-5.md`: "Video Generation (LTX-2.3)"
   * template, subgraph definition id
   * `98ee9e5b-467b-40aa-a534-36033f27d0b4`. Node 301 (`ComfyMathExpression`)
   * carries `"flags": { "collapsed": true }` in the real capture, giving a
   * SECOND real-production collapsed-node case with a different node type
   * than report 3's, from an unrelated template.
   */
  describe('real "Video Generation (LTX-2.3)" template, a second genuinely collapsed node (report 5)', () => {
    function insertLtxCollapsedNodeSubgraph(graph: LGraph) {
      return insertRealTemplateSubgraph(graph, [
        {
          type: 'ComfyMathExpression',
          id: 301,
          collapsed: true,
          values: { expression: 'a/2' }
        }
      ])
    }

    it('renders the widget of a real collapsed ComfyMathExpression interior node in Vue mode', () => {
      const graph = new LGraph()
      onTestFinished(enableSubgraphNodeCreation(graph))

      const { findInterior } = insertLtxCollapsedNodeSubgraph(graph)
      const expression = findInterior('ComfyMathExpression')
      expect(expression.flags.collapsed).toBe(true)
      expect(expression.widgets?.[0]?.value).toBe('a/2')

      const rendered = renderInteriorWidgetInVueMode(
        graph,
        expression,
        'expression'
      )
      expect(rendered).toBeDefined()
      expect(rendered?.visible).toBe(true)
      expect(rendered?.simplified.value).toBe('a/2')
    })
  })

  /**
   * `jo-zhang-crdt-debug-report-6.md` is NOT represented above. Its
   * workflow was too large for the debug report to embed at all ("workflow
   * omitted: 215626 characters -- attach the .json file instead"), and the
   * accompanying `-6-event-log.json` redacts every operation payload
   * (widget values as `"[REDACTED]"`, other strings as placeholders like
   * `"String(71)"`, node ids without a `type` field). No real node type,
   * widget name, or widget value is recoverable from report 6 at all, so
   * there is no real data left to build a fixture from -- adding one would
   * mean inventing synthetic data under a "real capture" label, which is
   * exactly what this expansion is trying to avoid.
   */
})
