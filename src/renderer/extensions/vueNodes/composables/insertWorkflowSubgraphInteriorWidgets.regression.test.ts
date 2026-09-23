/**
 * Christian Byrne (maintainer), reported live in Slack:
 *
 * 1. `insert_workflow` a template that contains a subgraph.
 * 2. Enter that subgraph.
 * 3. In VUE NODE MODE ONLY (litegraph mode renders fine), the widgets on
 *    nodes INSIDE the subgraph simply don't render. The widgets still work
 *    during actual execution, so the underlying value/data is fine -- this
 *    is a Vue-rendering-only bug.
 *
 * This drives the real pipeline (comfy-multi-player's `insert_workflow`
 * applier -> `AgentCrdtProjection` -> `graphMutations` ->
 * `agentNodeMaterializer`, the same pipeline `agentInsertWorkflow.*.test.ts`
 * and `agentSubgraphInsertWorkflow.regression.test.ts` exercise) to build a
 * REAL subgraph-owned node materialized via `insert_workflow`, then reads its
 * widgets back exactly two ways:
 *
 * - litegraph's own path: `node.widgets` (what the canvas renderer draws
 *   from, and what execution reads from).
 * - Vue's path: `computeProcessedWidgets`, fed the same `nodeData`/`widgetIds`
 *   `LGraphNode.vue` computes for a node once its owning graph (the entered
 *   subgraph) is the active canvas graph.
 *
 * A synthetic multi-widget-type node is used rather than a real downloaded
 * node type, since a unit test has no node-definition catalog to construct
 * a real backend node from; `templates/templates-2x2_grid-iso_miniatures.json`
 * in `Comfy-Org/workflow_templates` was used as the reference for a realistic
 * subgraph-with-diverse-interior-widgets shape (its "Prompt Template"
 * subgraph mixes text, boolean and multiline-text interior widgets).
 */
import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type {
  InsertWorkflowOp,
  WidgetCatalog
} from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, onTestFinished } from 'vitest'
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
import { AgentCrdtProjection } from '@/workbench/extensions/agent/crdt/agentCrdtProjection'
import { inertPlacementPort } from '@/workbench/extensions/agent/crdt/__fixtures__/inertPlacementPort'
import { FollowerDoc } from '@/workbench/extensions/agent/crdt/followerDoc'
import { createGraphMutations } from '@/workbench/extensions/agent/crdt/graphMutations'

import { computeProcessedWidgets } from './useProcessedWidgets'
import type { WidgetUiCallbacks } from './processedWidgetRenderModel'

/**
 * One node carrying every widget type Christian asked for variants of:
 * combo, number (int), float, text (string), toggle (boolean). None of
 * these widgets are wired to the subgraph's boundary inputs -- they are
 * ordinary, unpromoted interior widgets, exactly what you see immediately
 * after "Enter Subgraph" on a node that isn't itself promoting anything.
 */
class MultiWidgetInteriorNode extends LGraphNode {
  constructor() {
    super('multi-widget-interior')
    this.serialize_widgets = true
    this.addWidget('combo', 'mode', 'fixed', () => {}, {
      values: ['fixed', 'randomize']
    })
    this.addWidget('number', 'steps', 20, () => {})
    this.addWidget('number', 'cfg', 7.5, () => {}, { precision: 1 })
    this.addWidget('text', 'prompt', 'a cat', () => {})
    this.addWidget('toggle', 'enabled', true, () => {})
  }
}

const CATALOG: WidgetCatalog = {
  types: {
    'multi-widget-interior': {
      widget_order: ['mode', 'steps', 'cfg', 'prompt', 'enabled']
    },
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
    }
  }
}

/**
 * Real production node shapes, lifted from Jo Zhang's nightly CRDT debug
 * capture of an actual `insert_workflow` of the "Text to Image
 * (Z-Image-Turbo)" template (subgraph definition id
 * `f2fdebf6-dfaf-43b6-9eb2-7f70613cfdc1`, remapped host subgraph id
 * `30c21566-ff38-4afb-8096-c7be26a16f57`): the interior nodes' `type`,
 * widget names, widget types and default `widgets_values` match that
 * capture exactly. Real node classes aren't registered in a unit test (no
 * backend node-definition catalog), so these fixtures stand in for them --
 * same pattern `subgraphHelpers.ts`'s `FixtureStringConcatenateNode` uses
 * for `StringConcatenate`.
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

beforeEach(() => {
  LiteGraph.registerNodeType('multi-widget-interior', MultiWidgetInteriorNode)
  LiteGraph.registerNodeType('CLIPTextEncode', RealCLIPTextEncodeNode)
  LiteGraph.registerNodeType('EmptySD3LatentImage', RealEmptySD3LatentImageNode)
  LiteGraph.registerNodeType('KSampler', RealKSamplerNode)
})

let opSeq = 0
function insertOp(workflow: InsertWorkflowOp['workflow']): InsertWorkflowOp {
  opSeq += 1
  return {
    op_id: `insert-subgraph-vue-widgets-${opSeq}`.padEnd(32, '0'),
    actor: 'agent:test',
    base_version: 1,
    stamp: [1, 'agent:test'],
    op: 'insert_workflow',
    workflow
  }
}

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

  let seq = 0
  const deliver = (update: Uint8Array, opIds: string[]): boolean => {
    follower.applyRemoteUpdate(update)
    const committed = projection.applyFrame({
      workflowId,
      seq: ++seq,
      update,
      actor: 'agent:test',
      opIds
    })
    projection.reconcileLiveGraph(workflowId)
    return committed
  }
  return deliver
}

function serializeBlueprint(graph: LGraph): InsertWorkflowOp['workflow'] {
  return JSON.parse(
    JSON.stringify(graph.serialize())
  ) as InsertWorkflowOp['workflow']
}

const noopUi: WidgetUiCallbacks = {
  getTooltipConfig: () => ({}),
  handleNodeRightClick: () => {}
}

/**
 * What `LGraphNode.vue`'s own `widgetIds` computed does for the node once
 * its owning graph is the active canvas graph -- i.e. once the subgraph has
 * been entered. This is deliberately independent of `useCanvasStore`/Vue
 * mounting: it reads the exact two inputs that computed derives from
 * (`canvasStore.rootGraphId` and `nodeData.id`), which is what makes this a
 * faithful, mount-free stand-in for "Vue mode, subgraph entered".
 */
function vueWidgetIdsFor(rootGraphId: string, node: LGraphNode) {
  const bareNodeId = stripGraphPrefix(String(node.id))
  if (!bareNodeId) return []
  return useWidgetValueStore().getNodeWidgetIds(
    rootGraphId,
    bareNodeId
  )
}

/**
 * Sets up: a subgraph definition containing one `MultiWidgetInteriorNode`
 * with distinct, non-default values on every widget, instantiated into
 * `graph` via a real `insert_workflow` op.
 */
function insertSubgraphWithInteriorWidgets(graph: LGraph) {
  const blueprintGraph = new LGraph()
  const subgraph = createTestSubgraph({ rootGraph: blueprintGraph })
  blueprintGraph.subgraphs.set(subgraph.id, subgraph)

  const interior = LiteGraph.createNode('multi-widget-interior')!
  interior.id = toNodeId(42)
  subgraph.add(interior)
  interior.widgets![0].value = 'randomize'
  interior.widgets![1].value = 33
  interior.widgets![2].value = 3.5
  interior.widgets![3].value = 'a dog'
  interior.widgets![4].value = false

  const host = createTestSubgraphNode(subgraph, { id: 1 })
  blueprintGraph.add(host)

  const workflow = serializeBlueprint(blueprintGraph)
  const hostDoc = mint({ nodes: [], links: [] }, CATALOG)
  onTestFinished(() => hostDoc.destroy())
  const deliver = bindProjection('wf-subgraph-vue-widgets', graph)
  deliver(Y.encodeStateAsUpdate(hostDoc), [])

  const op = insertOp(workflow)
  const vector = Y.encodeStateVector(hostDoc)
  expect(applyOps(hostDoc, [op], CATALOG).outcomes).toEqual([
    { op_id: op.op_id, outcome: 'applied' }
  ])
  expect(deliver(Y.encodeStateAsUpdate(hostDoc, vector), [op.op_id])).toBe(true)

  const instance = graph._nodes.find(
    (node): node is SubgraphNode => node instanceof SubgraphNode
  )
  if (!instance) throw new Error('Expected a materialized SubgraphNode host')

  const materializedInterior = instance.subgraph._nodes.find(
    (node) => node.type === 'multi-widget-interior'
  )
  if (!materializedInterior) {
    throw new Error('Expected a materialized interior node')
  }

  return { instance, interior: materializedInterior }
}

/**
 * Sets up a subgraph shaped like the real "Text to Image (Z-Image-Turbo)"
 * template capture: three interior nodes (`CLIPTextEncode`,
 * `EmptySD3LatentImage`, `KSampler`) covering text, int, float and combo
 * widgets, instantiated into `graph` via a real `insert_workflow` op.
 */
function insertZImageTurboLikeSubgraph(graph: LGraph) {
  const blueprintGraph = new LGraph()
  const subgraph = createTestSubgraph({ rootGraph: blueprintGraph })
  blueprintGraph.subgraphs.set(subgraph.id, subgraph)

  const textEncode = LiteGraph.createNode('CLIPTextEncode')!
  textEncode.id = toNodeId(27)
  subgraph.add(textEncode)

  const latentImage = LiteGraph.createNode('EmptySD3LatentImage')!
  latentImage.id = toNodeId(13)
  subgraph.add(latentImage)

  const sampler = LiteGraph.createNode('KSampler')!
  sampler.id = toNodeId(3)
  subgraph.add(sampler)

  const host = createTestSubgraphNode(subgraph, { id: 1 })
  blueprintGraph.add(host)

  const workflow = serializeBlueprint(blueprintGraph)
  const hostDoc = mint({ nodes: [], links: [] }, CATALOG)
  onTestFinished(() => hostDoc.destroy())
  const deliver = bindProjection('wf-z-image-turbo-like', graph)
  deliver(Y.encodeStateAsUpdate(hostDoc), [])

  const op = insertOp(workflow)
  const vector = Y.encodeStateVector(hostDoc)
  expect(applyOps(hostDoc, [op], CATALOG).outcomes).toEqual([
    { op_id: op.op_id, outcome: 'applied' }
  ])
  expect(deliver(Y.encodeStateAsUpdate(hostDoc, vector), [op.op_id])).toBe(true)

  const instance = graph._nodes.find(
    (node): node is SubgraphNode => node instanceof SubgraphNode
  )
  if (!instance) throw new Error('Expected a materialized SubgraphNode host')

  const findInterior = (type: string) => {
    const node = instance.subgraph._nodes.find((n) => n.type === type)
    if (!node) throw new Error(`Expected a materialized ${type} node`)
    return node
  }

  return {
    instance,
    textEncode: findInterior('CLIPTextEncode'),
    latentImage: findInterior('EmptySD3LatentImage'),
    sampler: findInterior('KSampler')
  }
}

describe('insert_workflow subgraph-interior widgets render in Vue mode', () => {
  describe('real Z-Image-Turbo template shape (Jo Zhang nightly CRDT capture)', () => {
    it.for([
      ['CLIPTextEncode', 'text', 'text', ''],
      ['EmptySD3LatentImage', 'width', 'number', 1024],
      ['EmptySD3LatentImage', 'height', 'number', 1024],
      ['KSampler', 'seed', 'number', 0],
      ['KSampler', 'control_after_generate', 'combo', 'randomize'],
      ['KSampler', 'steps', 'number', 8],
      ['KSampler', 'cfg', 'number', 1],
      ['KSampler', 'sampler_name', 'combo', 'res_multistep'],
      ['KSampler', 'scheduler', 'combo', 'simple']
    ] as const)(
      "renders %s interior node's %s (%s) widget in Vue mode once the subgraph is entered",
      ([nodeType, widgetName, , expectedValue]) => {
        const graph = new LGraph()
        onTestFinished(enableSubgraphNodeCreation(graph))

        const { textEncode, latentImage, sampler } =
          insertZImageTurboLikeSubgraph(graph)
        const interior = {
          CLIPTextEncode: textEncode,
          EmptySD3LatentImage: latentImage,
          KSampler: sampler
        }[nodeType]

        const liveWidget = interior.widgets?.find((w) => w.name === widgetName)
        expect(liveWidget?.value).toBe(expectedValue)

        const rootGraphId = graph.rootGraph.id
        const widgetIds = vueWidgetIdsFor(rootGraphId, interior)
        expect(widgetIds.length).toBeGreaterThan(0)

        const processed = computeProcessedWidgets({
          nodeData: interior._state,
          widgetIds,
          graphId: rootGraphId,
          showAdvanced: false,
          isGraphReady: true,
          rootGraph: graph,
          ui: noopUi
        })

        const rendered = processed.find(
          (widget) => widget.simplified.name === widgetName
        )
        expect(rendered).toBeDefined()
        expect(rendered?.visible).toBe(true)
        expect(rendered?.simplified.value).toBe(expectedValue)
      }
    )
  })

  it('materializes the interior node with a colon-bearing id (insert_workflow remap)', () => {
    const graph = new LGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))

    const { interior } = insertSubgraphWithInteriorWidgets(graph)

    // Sanity: this really is an insert_workflow-remapped id (comfy-multi-player
    // remap.ts's derivedId), not a plain local id -- the same shape PM-1580's
    // root-level fix targeted, but here on a node owned by a subgraph
    // definition rather than the root graph.
    expect(String(interior.id)).toContain(':')
  })

  it.for([
    ['combo', 'mode', 'randomize'],
    ['number (int)', 'steps', 33],
    ['number (float)', 'cfg', 3.5],
    ['text', 'prompt', 'a dog'],
    ['toggle', 'enabled', false]
  ] as const)(
    'renders the interior %s widget in Vue mode once the subgraph is entered',
    ([, widgetName, expectedValue]) => {
      const graph = new LGraph()
      onTestFinished(enableSubgraphNodeCreation(graph))

      const { interior } = insertSubgraphWithInteriorWidgets(graph)

      // Control: litegraph's own render/execution path always finds the
      // widget and its value directly off the live node -- this is why
      // Christian could say "litegraph mode renders fine" and "the widgets
      // still work during execution".
      const liveWidget = interior.widgets?.find((w) => w.name === widgetName)
      expect(liveWidget?.value).toBe(expectedValue)

      // The bug: Vue mode, with the subgraph entered, resolves zero widgets
      // for this same node.
      const rootGraphId = graph.rootGraph.id
      const widgetIds = vueWidgetIdsFor(rootGraphId, interior)
      expect(widgetIds.length).toBeGreaterThan(0)

      const processed = computeProcessedWidgets({
        nodeData: interior._state,
        widgetIds,
        graphId: rootGraphId,
        showAdvanced: false,
        isGraphReady: true,
        rootGraph: graph,
        ui: noopUi
      })

      const rendered = processed.find(
        (widget) => widget.simplified.name === widgetName
      )
      expect(rendered).toBeDefined()
      expect(rendered?.visible).toBe(true)
      expect(rendered?.simplified.value).toBe(expectedValue)
    }
  )
})
