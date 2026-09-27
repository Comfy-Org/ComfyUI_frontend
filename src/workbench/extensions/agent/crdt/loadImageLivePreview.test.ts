// `useNodeOutputStore` (and the app bootstrap it pulls in) must finish
// loading before `useImageUploadWidget` is first imported below: that module
// also depends on the app bootstrap, and letting it be the one to trigger
// that load creates a real circular import where `scripts/widgets.ts` calls
// `useImageUploadWidget()` before this module has finished exporting it.
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createGraphMutations } from './graphMutations'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
// eslint-disable-next-line import-x/no-restricted-paths
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
// eslint-disable-next-line import-x/no-restricted-paths
import { LayoutSource } from '@/renderer/core/layout/types'
// Test-only: builds a node with the real renderer-owned widget constructor
// so the fixture's `image` widget carries the same preview-rendering
// callback a production LoadImage node does.
// eslint-disable-next-line import-x/no-restricted-paths
import { useImageUploadWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useImageUploadWidget'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import type { GraphScope } from '@/types/graphScopeId'
import {
  graphScopeOf,
  toOwningGraphId,
  toRootGraphId
} from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toNodeId } from '@/types/nodeId'

import { inertPlacementPort } from './__fixtures__/inertPlacementPort'
import { reconcileAgentAdapters } from './agentNodeMaterializer'
import { applyLiveWidgetValue } from './liveWidgetProjection'

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

/**
 * A Load-Image-shaped combo widget whose callback renders the preview from
 * its own argument, the way `useImageUploadWidget`'s callback renders it from
 * the live widget value. This isolates what the agent write path promises a
 * widget's callback (the value the CRDT record just settled on, per
 * `replayUpdatedWidgetCallbacks`) from that production widget's own,
 * unrelated quirk of re-reading `widget.value` instead of its argument.
 */
class MinimalLoadImageNode extends LGraphNode {
  constructor() {
    super('test-load-image-minimal', 'test-load-image-minimal')
    this.addWidget(
      'combo',
      'image',
      'previously-uploaded.png',
      (value: unknown) => {
        useNodeOutputStore().setNodeOutputs(this, String(value), {
          isAnimated: false
        })
        mocks.showPreview({ block: false })
      },
      { values: ['previously-uploaded.png'] }
    )
  }
}

const rootScope: GraphScope = {
  rootGraphId: toRootGraphId('root'),
  owningGraphId: toOwningGraphId('root')
}
const remoteContext: RemoteMutationContext = {
  source: 'agent-remote',
  actor: 'agent:test',
  opId: 'op-1'
}

function nodePayload(id: number, type: string) {
  return {
    id,
    type,
    pos: [0, 0],
    size: [200, 100],
    inputs: [],
    outputs: [],
    widgets_values: {}
  }
}

/** Same remote layout port `AgentPanelRoot.vue` wires in production. */
function remoteMutations(scope: GraphScope) {
  return createGraphMutations({
    getScope: () => scope,
    layout: {
      createNode(scope, nodeId, { position, size }, context) {
        layoutStore.applyOperation({
          type: 'createNode',
          graphId: scope.rootGraphId,
          ownerGraphId: scope.owningGraphId,
          nodeId,
          layout: {
            id: nodeId,
            position,
            size,
            bounds: { x: position.x, y: position.y, ...size },
            zIndex: layoutStore.allocateZIndex(),
            visible: true
          },
          source: LayoutSource.AgentRemote,
          actor: context.actor,
          opId: context.opId,
          timestamp: Date.now()
        })
      },
      deleteNodes: vi.fn()
    },
    placement: inertPlacementPort
  })
}

beforeEach(() => {
  LiteGraph.registerNodeType('test-load-image', TestLoadImageNode)
  LiteGraph.registerNodeType('test-load-image-minimal', MinimalLoadImageNode)
  vi.stubGlobal('requestAnimationFrame', vi.fn())
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
    graph.id = 'root'
    const node = new TestLoadImageNode()
    node.id = toNodeId(1)
    graph.add(node)

    const result = applyLiveWidgetValue(
      graph,
      rootScope,
      toNodeId(1),
      'image',
      'new-input-image.png',
      remoteContext
    )

    expect(result).toEqual({
      status: 'applied',
      resolvedValue: 'new-input-image.png'
    })
    expect(useNodeOutputStore().setNodeOutputs).toHaveBeenCalledWith(
      node,
      'new-input-image.png',
      { isAnimated: false }
    )
    expect(mocks.showPreview).toHaveBeenCalledWith({ block: false })
  })

  it('replays the preview callback once a brand-new node materializes with a value set before it existed (real-world: Memie Osuga)', () => {
    const graph = new LGraph()
    const scope = graphScopeOf(graph)
    const mutations = remoteMutations(scope)
    mutations.addNode(nodePayload(1, 'test-load-image-minimal'), remoteContext)
    mutations.setWidget(
      toNodeId(1),
      'image',
      'freshly-created-image.png',
      remoteContext
    )

    reconcileAgentAdapters(graph)

    const node = graph.getNodeById(toNodeId(1))
    expect(useNodeOutputStore().setNodeOutputs).toHaveBeenCalledWith(
      node,
      'freshly-created-image.png',
      { isAnimated: false }
    )
    expect(mocks.showPreview).toHaveBeenCalledWith({ block: false })
  })

  it('refreshes the real Load Image preview when a brand-new node materializes with a value set before it existed', () => {
    const graph = new LGraph()
    const scope = graphScopeOf(graph)
    const mutations = remoteMutations(scope)
    mutations.addNode(nodePayload(1, 'test-load-image'), remoteContext)
    mutations.setWidget(
      toNodeId(1),
      'image',
      'freshly-created-image.png',
      remoteContext
    )

    reconcileAgentAdapters(graph)

    const node = graph.getNodeById(toNodeId(1))
    expect(useNodeOutputStore().setNodeOutputs).toHaveBeenCalledWith(
      node,
      'freshly-created-image.png',
      { isAnimated: false }
    )
    expect(mocks.showPreview).toHaveBeenCalledWith({ block: false })
  })
})
