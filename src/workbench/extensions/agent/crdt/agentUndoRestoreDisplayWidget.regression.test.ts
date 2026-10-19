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
import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import type { GraphOperation } from './graphOperations'
import { mintWireOps } from './opEnvelope'
import {
  attachRestoreOpMinter,
  notifyRestoreMintersAfterGraphConfigure,
  notifyRestoreMintersBeforeGraphLoad
} from './restoreOpMinter'
import type { RestoreOpMinter } from './restoreOpMinter'

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

describe('PM-2165: undo restores a deleted node that has a display-only DOM widget', () => {
  let graph: LGraph
  let minted: GraphOperation[]
  let minter: RestoreOpMinter

  beforeEach(() => {
    LiteGraph.registerNodeType(LOAD_VIDEO, LoadVideoWithPreview)
    LiteGraph.registerNodeType('PreviewSink', PreviewSink)
    useNodeDefStore().addNodeDef(LOAD_VIDEO_DEF)
    graph = new LGraph()
    minted = []
    minter = attachRestoreOpMinter({
      isEnabled: () => true,
      isDocBound: () => true,
      enqueue: (operations) => minted.push(...operations),
      getGraph: () => graph,
      docInputNames: () => null,
      isRestoringState: () => true
    })
  })

  afterEach(() => minter.detach())

  it('mints a restore batch the doc host applies whole', () => {
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

    notifyRestoreMintersBeforeGraphLoad()
    graph.configure(beforeDelete)
    notifyRestoreMintersAfterGraphConfigure()

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
