import { mint, nodesMap } from '@comfyorg/comfy-multi-player'
import { render } from '@testing-library/vue'
import { pick } from 'es-toolkit'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { defineComponent, nextTick, ref, shallowRef } from 'vue'
import * as Y from 'yjs'

import { createGraphMutations } from '@/core/graph/graphMutations'
import {
  createTestNode,
  createTestWidgetNode
} from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { api } from '@/scripts/api'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import {
  docResetFrame,
  docSubscribedFrame,
  docUpdateFrame
} from './__fixtures__/docFrameClient'
import { encodeBase64 } from './docFrameClient'
import { apiTransport, useAgentCrdtFollower } from './useAgentCrdtFollower'

function deliver(frame: { type: string; data: unknown }) {
  const target: EventTarget = api
  target.dispatchEvent(new CustomEvent(frame.type, { detail: frame.data }))
}

function deliverUpdate(host: Y.Doc, workflowId: string, seq = 1) {
  deliver(
    docUpdateFrame({
      workflow_id: workflowId,
      seq,
      update_b64: encodeBase64(Y.encodeStateAsUpdate(host))
    })
  )
}

const WIDGET_TYPES = {
  'test/widgetNode': { widget_order: ['text_widget'] },
  'test/lateNode': { widget_order: ['late_widget'] }
}

function snapshot(
  workflowId: string,
  { nodes, links }: Pick<ReturnType<LGraph['serialize']>, 'nodes' | 'links'>
) {
  const host = mint(
    {
      nodes: nodes.map((node) => ({ ...node, flags: { ...node.flags } })),
      links
    },
    { types: WIDGET_TYPES }
  )
  onTestFinished(() => host.destroy())
  deliverUpdate(host, workflowId)
  return host
}

function mountFollower() {
  const graph = shallowRef(new LGraph())
  createTestWidgetNode(graph.value)
  const workflowId = ref<string | null>('wf-a')
  const mutations = createGraphMutations({
    getScope: () => graphScopeOf(graph.value),
    layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
  })
  const { unmount } = render(
    defineComponent({
      setup() {
        useAgentCrdtFollower(
          workflowId,
          mutations,
          () => null,
          ref(true),
          () => graph.value
        )
        return () => null
      }
    })
  )
  onTestFinished(unmount)
  snapshot('wf-a', graph.value.serialize())
  return { graph, workflowId }
}

describe('useAgentCrdtFollower graph catch-up', () => {
  beforeEach(() => {
    useAgentPanelStore().enabled = true
    vi.spyOn(apiTransport, 'send').mockReturnValue(true)
  })

  function firstWidget(node: LGraphNode) {
    const widget = node.widgets?.[0]
    assert(widget, 'missing widget')
    return widget
  }

  /**
   * Arranges a tab switch: a second workflow is loaded into the follower's
   * graph, the follower retargets to it and completes the subscribe handshake
   * (one not_found retry). No assertions here; the named tests own them.
   */
  async function loadSecondWorkflow(retainedType: 'widget' | 'plain') {
    const { graph, workflowId } = mountFollower()
    const widgetConstructor = graph.value._nodes[0].constructor
    workflowId.value = null
    await nextTick()

    const target = new LGraph()
    const retained =
      retainedType === 'plain'
        ? createTestNode(target, ['number'], ['number'])
        : createTestWidgetNode(target)
    const removed = createTestWidgetNode(target)
    retained.title = 'Loaded workflow'
    retained.pos = [123, 456]
    retained.onRemoved = vi.fn()
    if (retainedType === 'widget') firstWidget(retained).value = 'local value'
    retained.connect(0, removed, 0)
    const loaded = pick(target.serialize(), ['nodes', 'links'])
    graph.value = target
    await nextTick()

    workflowId.value = 'wf-b'
    await nextTick()
    deliver(
      docSubscribedFrame({
        workflow_id: 'wf-b',
        ok: false,
        code: 'not_found'
      })
    )
    vi.advanceTimersByTime(500)
    deliver(docSubscribedFrame({ workflow_id: 'wf-b' }))

    const scope = graphScopeOf(target)
    return { target, retained, removed, loaded, scope, widgetConstructor }
  }

  function expectAuthoritativeTopology(
    target: LGraph,
    authoritative: Pick<ReturnType<LGraph['serialize']>, 'nodes' | 'links'>
  ) {
    expect(target._nodes.map(({ id }) => id)).toEqual(
      authoritative.nodes.map(({ id }) => toNodeId(id))
    )
    expect(target.serialize().links).toEqual(authoritative.links)
  }

  function expectRemoteValueFlows(
    host: Y.Doc,
    live: LGraphNode,
    scope: ReturnType<typeof graphScopeOf>
  ) {
    const widgets = nodesMap(host).get(String(live.id))?.get('widgets')
    assert(widgets instanceof Y.Map, 'missing widgets')
    widgets.set('text_widget', 'remote value')
    deliverUpdate(host, 'wf-b', 2)
    expect(
      useWidgetValueStore().getWidget(
        widgetId(scope.rootGraphId, live.id, 'text_widget')
      )
    ).toMatchObject({ value: 'remote value' })
    expect(firstWidget(live).value).toBe('remote value')
  }

  it('keeps the loaded graph and its records through the subscribe handshake', async () => {
    const { target, retained, removed, loaded, scope } =
      await loadSecondWorkflow('widget')

    expect(target._nodes[0]).toBe(retained)
    expect(target._nodes[1]).toBe(removed)
    expect(target.serialize()).toMatchObject(loaded)
    expect(
      useNodeDataStore().getGraphNodesFor(
        scope.rootGraphId,
        scope.owningGraphId
      )[0]
    ).toBe(retained._state)
  })

  it('keeps the loaded nodes when the first document matches them', async () => {
    const { target, retained, loaded, scope } =
      await loadSecondWorkflow('widget')

    const host = snapshot('wf-b', loaded)

    expectAuthoritativeTopology(target, loaded)
    expect(target._nodes[0]).toBe(retained)
    expect(retained.title).toBe(loaded.nodes[0].title)
    expect(firstWidget(retained)).toMatchObject({
      name: 'text_widget',
      type: 'text',
      value: 'local value'
    })
    expectRemoteValueFlows(host, retained, scope)
  })

  it('reconciles the loaded node in place when the first document differs', async () => {
    const { target, retained, loaded, scope } =
      await loadSecondWorkflow('widget')
    const authoritative = {
      nodes: [{ ...loaded.nodes[0], title: 'Host workflow' }],
      links: []
    }

    const host = snapshot('wf-b', authoritative)

    expectAuthoritativeTopology(target, authoritative)
    expect(target._nodes[0]).toBe(retained)
    expect(retained.title).toBe('Host workflow')
    expect(firstWidget(retained)).toMatchObject({
      name: 'text_widget',
      type: 'text',
      value: 'local value'
    })
    expectRemoteValueFlows(host, retained, scope)
  })

  it('clears the loaded nodes when the first document is empty', async () => {
    const { target } = await loadSecondWorkflow('widget')

    snapshot('wf-b', { nodes: [], links: [] })

    expect(target._nodes).toEqual([])
    expect(target.serialize().links).toEqual([])
  })

  it('replaces the loaded node when the first document changes its type', async () => {
    const { target, retained, removed, loaded, scope, widgetConstructor } =
      await loadSecondWorkflow('plain')
    const authoritative = {
      nodes: [
        {
          ...loaded.nodes[0],
          title: 'Host workflow',
          type: removed.type,
          widgets_values: ['host value']
        }
      ],
      links: []
    }

    const host = snapshot('wf-b', authoritative)

    expectAuthoritativeTopology(target, authoritative)
    const live = target._nodes[0]
    expect(live).not.toBe(retained)
    expect(live.constructor).toBe(widgetConstructor)
    expect(retained.graph).toBeNull()
    expect(retained.onRemoved).toHaveBeenCalledOnce()
    expect(live.title).toBe('Host workflow')
    expect(firstWidget(live)).toMatchObject({
      name: 'text_widget',
      type: 'text',
      value: 'host value'
    })
    expectRemoteValueFlows(host, live, scope)
  })

  it('materializes a placeholder into the real node once its type registers', () => {
    class LateNode extends LGraphNode {
      constructor(title: string) {
        super(title)
        this.addInput('in', 'number')
        this.addWidget('text', 'late_widget', '', () => {})
        this.serialize_widgets = true
      }
    }
    const { graph } = mountFollower()
    const authoring = new LGraph()
    const origin = createTestWidgetNode(authoring)
    const late = new LateNode('Late')
    late.type = 'test/lateNode'
    authoring.add(late)
    firstWidget(late).value = 'late value'
    const link = origin.connect(0, late, 0)
    assert(link, 'missing link')
    const authoritative = pick(authoring.serialize(), ['nodes', 'links'])
    expect(
      Object.hasOwn(LiteGraph.registered_node_types, 'test/lateNode')
    ).toBe(false)

    deliver(docResetFrame({ workflow_id: 'wf-a', seq: 2 }))
    snapshot('wf-a', authoritative)

    const placeholder = graph.value.getNodeById(late.id)
    expect(placeholder?.constructor).toBe(LGraphNode)
    expect(placeholder?.has_errors).toBe(true)

    LiteGraph.registerNodeType('test/lateNode', LateNode)

    const live = graph.value.getNodeById(late.id)
    expect(live).toBeInstanceOf(LateNode)
    expect(live?.widgets?.[0]).toMatchObject({
      name: 'late_widget',
      value: 'late value'
    })
    expect(live?.inputs[0]?.link).toBe(link.id)
    expect(live?.getInputLink(0)?.origin_id).toBe(origin.id)
  })

  it('clears live nodes immediately on an explicit document reset', () => {
    const { graph } = mountFollower()
    expect(graph.value._nodes).toHaveLength(1)

    deliver(docResetFrame({ workflow_id: 'wf-a', seq: 2 }))

    expect(graph.value._nodes).toEqual([])
    expect(graph.value.serialize().nodes).toEqual([])
    snapshot('wf-a', { nodes: [], links: [] })
    expect(graph.value._nodes).toEqual([])
  })
})
