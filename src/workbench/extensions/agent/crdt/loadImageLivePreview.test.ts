// `useNodeOutputStore` (and the app bootstrap it pulls in) must finish
// loading before `useImageUploadWidget` is first imported below: that module
// also depends on the app bootstrap, and letting it be the one to trigger
// that load creates a real circular import where `scripts/widgets.ts` calls
// `useImageUploadWidget()` before this module has finished exporting it.
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
// Test-only: builds a node with the real renderer-owned widget constructor
// so the fixture's `image` widget carries the same preview-rendering
// callback a production LoadImage node does.
// eslint-disable-next-line import-x/no-restricted-paths
import { useImageUploadWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useImageUploadWidget'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import { toNodeId } from '@/types/nodeId'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { FollowerDoc } from './followerDoc'

const mocks = vi.hoisted(() => ({ showPreview: vi.fn() }))

vi.mock(import('@/composables/node/useNodeImage'), () => ({
  useNodeImage: () => ({ showPreview: mocks.showPreview }),
  useNodeVideo: () => ({ showPreview: mocks.showPreview })
}))

vi.mock<unknown>(import('@/composables/node/useNodeImageUpload'), () => ({
  useNodeImageUpload: () => ({ openFileSelection: vi.fn() })
}))

vi.mock(import('@/i18n'))

vi.mock(import('@/utils/litegraphUtil'))

/**
 * Same two-widget shape production LoadImage-style nodes use: a plain combo
 * widget for the stored filename, augmented by `useImageUploadWidget` with the
 * callback that renders the preview.
 */
class TestLoadImageNode extends LGraphNode {
  constructor() {
    super('test-load-image', 'test-load-image')
    this.addWidget(
      'combo',
      'image',
      'previously-uploaded.png',
      () => undefined,
      {
        values: ['previously-uploaded.png']
      }
    )
    useImageUploadWidget()(
      this,
      'upload',
      [
        'IMAGEUPLOAD',
        { imageInputName: 'image', image_upload: true }
      ] as InputSpec,
      fromPartial({})
    )
  }
}

const WORKFLOW_ID = 'wf-load-image'
const CATALOG: WidgetCatalog = {
  types: { 'test-load-image': { widget_order: ['image', 'upload'] } }
}

function setWidgetOp(value: string): Op {
  return {
    op: 'set_widget',
    op_id: 'set-image'.padEnd(32, '0'),
    actor: 'agent:test',
    base_version: 1,
    stamp: [1, 'agent:test'],
    node_id: 1,
    widget: 'image',
    value
  }
}

function bindProjection(graph: LGraph, host: Y.Doc) {
  const follower = new FollowerDoc()
  const projection = new AgentCrdtProjection(() => graph)
  projection.bind(WORKFLOW_ID, follower)
  onTestFinished(() => {
    projection.destroy()
    follower.destroy()
    host.destroy()
  })
  let seq = 0
  const deliver = (update: Uint8Array, opIds: string[]) => {
    follower.applyRemoteUpdate(update)
    expect(
      projection.applyFrame({
        workflowId: WORKFLOW_ID,
        seq: ++seq,
        update,
        actor: 'agent:test',
        opIds
      })
    ).not.toBeNull()
  }
  const hostApplies = (op: Op) => {
    const before = Y.encodeStateVector(host)
    expect(applyOps(host, [op], CATALOG).outcomes).toEqual([
      { op_id: op.op_id, outcome: 'applied' }
    ])
    deliver(Y.encodeStateAsUpdate(host, before), [op.op_id])
  }
  return { deliver, hostApplies }
}

const rafCallbacks = vi.hoisted(() => [] as FrameRequestCallback[])

beforeEach(() => {
  LiteGraph.registerNodeType('test-load-image', TestLoadImageNode)
  rafCallbacks.length = 0
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => rafCallbacks.push(callback))
  )
  vi.mocked(useNodeOutputStore().setNodeOutputs).mockImplementation(
    () => undefined
  )
})

describe('agent-driven Load Image preview stays live', () => {
  // Regression coverage for real bug reports: an agent-authored widget write
  // updated the graph's stored value correctly, but the canvas kept showing
  // the previous image until the user switched tabs or reloaded.

  it('refreshes the rendered preview when the agent updates an existing node (real-world: Zhixiong Lin)', () => {
    const graph = new LGraph()
    const node = new TestLoadImageNode()
    node.id = toNodeId(1)
    graph.add(node)
    const host = mint(
      {
        nodes: [
          {
            id: 1,
            type: 'test-load-image',
            widgets_values: ['previously-uploaded.png', 'image']
          }
        ],
        links: []
      },
      CATALOG
    )
    const { deliver, hostApplies } = bindProjection(graph, host)
    deliver(Y.encodeStateAsUpdate(host), [])
    vi.mocked(useNodeOutputStore().setNodeOutputs).mockClear()
    mocks.showPreview.mockClear()

    hostApplies(setWidgetOp('new-input-image.png'))

    expect(node.widgets?.[0]?.value).toBe('new-input-image.png')
    expect(useNodeOutputStore().setNodeOutputs).toHaveBeenCalledWith(
      node,
      'new-input-image.png',
      { isAnimated: false }
    )
    expect(mocks.showPreview).toHaveBeenCalledWith({ block: false })
  })

  it('renders the preview from the doc value when a brand-new node is created with that value (real-world: Memie Osuga)', () => {
    const graph = new LGraph()
    const host = mint(
      {
        nodes: [
          {
            id: 1,
            type: 'test-load-image',
            widgets_values: ['freshly-created-image.png', 'image']
          }
        ],
        links: []
      },
      CATALOG
    )
    const { deliver } = bindProjection(graph, host)

    deliver(Y.encodeStateAsUpdate(host), [])
    for (const callback of rafCallbacks) callback(0)

    const node = graph.getNodeById(toNodeId(1))
    expect(node?.widgets?.[0]?.value).toBe('freshly-created-image.png')
    expect(useNodeOutputStore().setNodeOutputs).toHaveBeenCalledWith(
      node,
      'freshly-created-image.png',
      { isAnimated: false }
    )
    expect(mocks.showPreview).toHaveBeenCalledWith({ block: false })
  })
})
