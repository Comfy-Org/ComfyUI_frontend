import { mint } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { assert } from '@/base/assert'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { GraphScope } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import { inertPlacementPort } from './__fixtures__/inertPlacementPort'
import { AgentCrdtProjection } from './agentCrdtProjection'
import { FollowerDoc } from './followerDoc'
import { createGraphMutations } from './graphMutations'

/**
 * PM-1303 / PM-1310 hypothesis C: the CRDT follower's catch-up reconcile
 * (`applyQueuedFrame` -> `reconcileNode` -> `applyWidgetValues`) rewrites
 * every widget of a live node from the doc snapshot with no
 * "touched more recently locally" check (the PM-1155 / PM-1192 / PM-1296
 * family). The reported repro ran under the agent's doc host, so a reconcile
 * landing around the second generation is a candidate for the prompt box
 * losing its content. The doc host is not available to Vitest, so this drives
 * the real projection against a real Yjs doc over a live litegraph node.
 */

const WORKFLOW_ID = 'wf-flux2'
const NODE_TYPE = 'Flux2ImageNode'
const PROMPT_TYPED_BY_USER = 'a glorious spooky duck in a cathedral'
const RUNNING_STATUS = 'Status: Running\nTime elapsed: 3s (~117s remaining)'

const CATALOG: WidgetCatalog = {
  types: {
    [NODE_TYPE]: {
      widget_order: [
        'prompt',
        'model',
        'model.width',
        'model.height',
        'seed',
        'control_after_generate'
      ]
    }
  }
}

/** The widget set a live Flux2ImageNode registers, in litegraph order. */
class TestFlux2Image extends LGraphNode {
  static override title = 'Flux.2 Image'
  constructor() {
    super('Flux.2 Image')
    this.addCustomWidget({
      name: 'prompt',
      type: 'customtext',
      value: '',
      options: { multiline: true },
      y: 0
    })
    this.addWidget('combo', 'model', 'Flux.2 [pro]', () => {}, {
      values: ['Flux.2 [pro]', 'Flux.2 [max]']
    })
    this.addWidget('number', 'model.width', 1024, () => {}, {})
    this.addWidget('number', 'model.height', 768, () => {}, {})
    this.addWidget('number', 'seed', 0, () => {}, {})
    this.addWidget('combo', 'control_after_generate', 'fixed', () => {}, {
      values: ['fixed', 'randomize']
    })
    this.addInput('model.images.image_1', 'IMAGE')
    this.addOutput('IMAGE', 'IMAGE')
    this.serialize_widgets = true
  }
}

function widgetsOf(node: LGraphNode) {
  assert(node.widgets, 'test node registers widgets', { title: node.title })
  return node.widgets
}

function promptOf(node: LGraphNode) {
  const prompt = widgetsOf(node).find((w) => w.name === 'prompt')
  assert(prompt, 'test node registers a prompt widget')
  return prompt
}

/** What `showTextPreview` appends during a generation; nothing removes it. */
function addProgressText(node: LGraphNode) {
  node.addCustomWidget({
    name: '$$node-text-preview',
    type: 'progressText',
    value: RUNNING_STATUS,
    options: {},
    serialize: false,
    y: 0
  })
}

const layout = { createNode: vi.fn(), deleteNodes: vi.fn() }

function remoteMutations(scope: GraphScope) {
  return createGraphMutations({
    getScope: () => scope,
    layout,
    placement: inertPlacementPort
  })
}

function toWorkflowJson({ nodes, ...rest }: ISerialisedGraph): WorkflowJSON {
  return {
    ...rest,
    nodes: nodes.map(({ flags, ...node }) => ({ ...node, flags: { ...flags } }))
  }
}

/**
 * Binds a follower to a doc minted from `saved` and delivers the whole doc as
 * the catch-up frame, the way returning to a bound workflow tab does.
 */
function bindAndCatchUp(graph: LGraph, saved: ISerialisedGraph) {
  const host = mint(toWorkflowJson(saved), CATALOG)
  const follower = new FollowerDoc()
  const projection = new AgentCrdtProjection(
    remoteMutations(graphScopeOf(graph)),
    () => graph,
    () => follower.doc
  )
  projection.bind(WORKFLOW_ID, follower)
  const update = Y.encodeStateAsUpdate(host)
  follower.applyRemoteUpdate(update)
  const committed = projection.applyFrame({
    workflowId: WORKFLOW_ID,
    seq: 1,
    update,
    actor: 'agent:comfy:host',
    opIds: []
  })
  projection.reconcileLiveGraph(WORKFLOW_ID)
  const destroy = () => {
    projection.destroy()
    follower.destroy()
    host.destroy()
  }
  return { committed, destroy }
}

/**
 * The node was added with an empty prompt (that save is what the doc holds),
 * the user then typed a prompt and, when `runningGeneration` is set, ran a
 * generation, which appended the progress-text widget. A catch-up frame then
 * reconciles the live node against the mint-time doc entry.
 */
function reconcileAfterUserTypedPrompt({
  runningGeneration = true
}: { runningGeneration?: boolean } = {}) {
  const graph = new LGraph()
  const node = LiteGraph.createNode(NODE_TYPE)
  assert(node instanceof TestFlux2Image, 'Flux2ImageNode test type registered')
  graph.add(node)
  const mintTimeSave = structuredClone(graph.serialize())

  promptOf(node).value = PROMPT_TYPED_BY_USER
  if (runningGeneration) addProgressText(node)

  const { committed, destroy } = bindAndCatchUp(graph, mintTimeSave)
  return { graph, node, committed, destroy }
}

function storeWidgetTuples(graph: LGraph, node: LGraphNode) {
  return useWidgetValueStore()
    .getNodeWidgets(graphScopeOf(graph).rootGraphId, node.id)
    .map(({ name, type }) => [name, type])
}

beforeEach(() => {
  layout.createNode.mockReset()
  layout.deleteNodes.mockReset()
  LiteGraph.registerNodeType(NODE_TYPE, TestFlux2Image)
})

describe('Flux2ImageNode prompt through a follower catch-up reconcile (PM-1303 / PM-1310)', () => {
  it('keeps the prompt registered as a visible customtext widget', () => {
    const { graph, node, committed, destroy } = reconcileAfterUserTypedPrompt()
    expect(committed).toBe(true)

    expect(graph.getNodeById(toNodeId(1))).toBe(node)
    expect(storeWidgetTuples(graph, node)).toEqual([
      ['prompt', 'customtext'],
      ['model', 'combo'],
      ['model.width', 'number'],
      ['model.height', 'number'],
      ['seed', 'number'],
      ['control_after_generate', 'combo'],
      ['$$node-text-preview', 'progressText']
    ])
    expect(
      useWidgetValueStore().getWidgetVisibility(
        widgetId(graphScopeOf(graph).rootGraphId, node.id, 'prompt')
      )
    ).toMatchObject({
      surfaces: { vueNode: 'shown' },
      suppression: { byExtension: false, byConnection: false }
    })
    destroy()
  })

  it('hypothesis C: keeps the prompt the user typed when the doc snapshot predates it', () => {
    const { node, committed, destroy } = reconcileAfterUserTypedPrompt()
    expect(committed).toBe(true)

    // PM-1303/PM-1310 hypothesis C: applyWidgetValues overwrites the live
    // prompt with the doc's mint-time '' and the text box reads empty.
    expect(promptOf(node).value).toBe(PROMPT_TYPED_BY_USER)
    destroy()
  })

  it('keeps a directly-edited prompt with no generation in flight (Jo Zhang repro)', () => {
    // PM-1524: editing an existing node's prompt directly, with no generation
    // running, so no progress-text widget appears on the node at all. The
    // catch-up reconcile still replays the mint-time doc snapshot, so this is
    // the same clobber with one less widget on the node.
    const { node, committed, destroy } = reconcileAfterUserTypedPrompt({
      runningGeneration: false
    })
    expect(committed).toBe(true)
    expect(promptOf(node).value).toBe(PROMPT_TYPED_BY_USER)
    destroy()
  })
})
