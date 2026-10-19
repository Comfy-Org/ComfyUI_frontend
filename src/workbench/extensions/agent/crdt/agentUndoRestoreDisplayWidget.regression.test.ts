import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
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

/**
 * PM-2165: the agent deleted rows of a workflow that used VideoHelperSuite, and
 * Ctrl+Z could not bring them back. The undo re-add of a video node carried its
 * display-only `videopreview` DOM widget (`serialize: false`, not a definition
 * input) as a named value, the doc host refused the `add_node` with
 * `unknown_widget`, and the whole restore batch was dropped.
 *
 * The node's own widget form (schema A24, PM-2003) now declares that widget, so
 * the host takes the add. This pins the reported path end to end: undo restore
 * minter → wire ops → the real applier, with a catalog that does not list the
 * preview widget, as the pinned catalog does not.
 */
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
    graph.remove(loader)
    const doc = mint(graph.serialize() as unknown as WorkflowJSON, CATALOG)

    const restored = new LoadVideoWithPreview()
    restored.id = loader.id
    notifyRestoreMintersBeforeGraphLoad()
    graph.add(restored)
    restored.connect(0, sink, 0)
    notifyRestoreMintersAfterGraphConfigure()

    expect(minted.map((operation) => operation.op)).toEqual([
      'add_node',
      'connect'
    ])
    const { outcomes } = applyOps(
      doc,
      mintWireOps(minted, { actor: 'human:user:tab', baseVersion: 1 }),
      CATALOG
    )
    expect(outcomes.map((outcome) => outcome.outcome)).toEqual([
      'applied',
      'applied'
    ])
    doc.destroy()
  })
})
