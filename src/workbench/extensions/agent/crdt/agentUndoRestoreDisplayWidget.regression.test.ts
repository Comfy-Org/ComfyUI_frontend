import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished
} from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedGraph } from '@comfyorg/graph-model/serialisation'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { validateComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { emitGraphRestored } from '@/scripts/graphRestore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { toRootGraphId } from '@comfyorg/graph-model/graphScopeId'

import { attachDocOpMinter } from './docOpMinter'
import type { DocOpMinter } from './docOpMinter'
import type { GraphOperation } from './graphOperations'
import { mintWireOps } from './opEnvelope'

const LOAD_VIDEO = 'VHS_LoadVideo'

const LOAD_VIDEO_DEF: ComfyNodeDefV1 = {
  name: LOAD_VIDEO,
  display_name: 'Load Video (Upload)',
  category: 'Video Helper Suite',
  python_module: 'custom_nodes.ComfyUI-VideoHelperSuite',
  description: '',
  input: { required: { video: [['clip.mp4'], {}] } },
  output: ['IMAGE'],
  output_name: ['IMAGE'],
  output_is_list: [false],
  output_node: false
}

const CATALOG: WidgetCatalog = {
  types: {
    [LOAD_VIDEO]: { widget_order: ['video'] },
    PreviewSink: { widget_order: [] }
  }
}

class LoadVideoWithPreview extends LGraphNode {
  constructor() {
    super(LOAD_VIDEO, LOAD_VIDEO)
    this.addWidget('combo', 'video', 'clip.mp4', () => {}, {
      values: ['clip.mp4']
    })
    let preview: Record<string, unknown> = { hidden: false, params: {} }
    this.addDOMWidget(
      'videopreview',
      'preview',
      document.createElement('div'),
      {
        serialize: false,
        getValue: () => preview,
        setValue: (value: Record<string, unknown>) => {
          preview = value
        }
      }
    )
    this.addOutput('IMAGE', 'IMAGE')
    this.serialize_widgets = true
  }
}

class PreviewSink extends LGraphNode {
  constructor() {
    super('PreviewSink', 'PreviewSink')
    this.addInput('images', 'IMAGE')
  }
}

function toWorkflowJson({ nodes, ...rest }: ISerialisedGraph): WorkflowJSON {
  return {
    ...rest,
    nodes: nodes.map(({ flags, ...node }) => ({ ...node, flags: { ...flags } }))
  }
}

async function workflowJson(graph: LGraph): Promise<ComfyWorkflowJSON> {
  const state = await validateComfyWorkflow(graph.serialize(), (error) => {
    throw new Error(error)
  })
  if (!state) throw new Error('graph did not serialize to a valid workflow')
  return JSON.parse(JSON.stringify(state)) as ComfyWorkflowJSON
}

function afterFlush(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve))
}

describe('PM-2165: undo restores a deleted node that has a display-only DOM widget', () => {
  let graph: LGraph
  let minted: GraphOperation[]
  let minter: DocOpMinter

  beforeEach(() => {
    LiteGraph.registerNodeType(LOAD_VIDEO, LoadVideoWithPreview)
    LiteGraph.registerNodeType('PreviewSink', PreviewSink)
    useNodeDefStore().addNodeDef(LOAD_VIDEO_DEF)
    graph = new LGraph()
    minted = []
    minter = attachDocOpMinter({
      isEnabled: () => true,
      isDocBound: () => true,
      enqueue: (operations) => minted.push(...operations),
      getGraph: () => graph,
      boundRootGraphId: () => toRootGraphId(graph.id),
      docInputNames: () => null,
      docPromotedWidgets: () => null,
      docWidgetValue: () => undefined,
      mayWritePromotedHost: () => true,
      docHasSubgraphDefinition: () => false,
      onWidgetWriteRefused: () => {}
    })
  })

  afterEach(() => minter.detach())

  it('mints a restore batch the doc host applies whole', async () => {
    const sink = new PreviewSink()
    graph.add(sink)
    const loader = new LoadVideoWithPreview()
    graph.add(loader)
    loader.connect(0, sink, 0)
    const linkId = sink.inputs[0].link
    assert(linkId != null)
    const beforeDelete = graph.serialize()
    const doc = mint(toWorkflowJson(beforeDelete), CATALOG)
    onTestFinished(() => doc.destroy())

    graph.remove(loader)
    await afterFlush()
    minted.length = 0
    const deleted = applyOps(
      doc,
      mintWireOps(
        [
          {
            op: 'delete_node',
            node_id: String(loader.id),
            removed_links: [linkId]
          }
        ],
        { actor: 'agent:turn', baseVersion: 1 }
      ),
      CATALOG
    )
    expect(deleted.outcomes.map((outcome) => outcome.outcome)).toEqual([
      'applied'
    ])

    const previous = await workflowJson(graph)
    graph.configure(beforeDelete)
    emitGraphRestored({ previous, next: await workflowJson(graph) })
    await afterFlush()

    expect(minted.map((operation) => operation.op)).toEqual([
      'add_node',
      'connect'
    ])
    expect(minted[0]).toHaveProperty('node.widgets_values.videopreview')
    const { outcomes } = applyOps(
      doc,
      mintWireOps(minted, { actor: 'human:user:tab', baseVersion: 2 }),
      CATALOG
    )
    expect(outcomes.map((outcome) => outcome.outcome)).toEqual([
      'applied',
      'applied'
    ])
  })
})
