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
import { LGraph } from '@/lib/litegraph/src/litegraph'
import { api } from '@/scripts/api'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

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

function snapshot(
  workflowId: string,
  { nodes, links }: Pick<ReturnType<LGraph['serialize']>, 'nodes' | 'links'>
) {
  const host = mint(
    {
      nodes: nodes.map((node) => ({ ...node, flags: { ...node.flags } })),
      links
    },
    { types: { 'test/widgetNode': { widget_order: ['text_widget'] } } }
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
    vi.spyOn(apiTransport, 'send').mockReturnValue(true)
  })

  it.for(['same', 'different', 'empty', 'new-type'] as const)(
    'preserves the loaded graph until the first %s document arrives',
    async (content) => {
      const { graph, workflowId } = mountFollower()
      const widgetConstructor = graph.value._nodes[0].constructor
      workflowId.value = null
      await nextTick()

      const target = new LGraph()
      const retained =
        content === 'new-type'
          ? createTestNode(target, ['number'], ['number'])
          : createTestWidgetNode(target)
      const removed = createTestWidgetNode(target)
      retained.title = 'Loaded workflow'
      retained.pos = [123, 456]
      retained.onRemoved = vi.fn()
      if (content !== 'new-type') retained.widgets![0].value = 'local value'
      retained.connect(0, removed, 0)
      const loaded = pick(target.serialize(), ['nodes', 'links'])
      graph.value = target
      await nextTick()

      workflowId.value = 'wf-b'
      await nextTick()

      expect(target._nodes[0]).toBe(retained)
      expect(target._nodes[1]).toBe(removed)
      expect(target.serialize()).toMatchObject(loaded)
      const scope = graphScopeOf(target)
      expect(
        useNodeDataStore().getGraphNodesFor(
          scope.rootGraphId,
          scope.owningGraphId
        )[0]
      ).toBe(retained._state)

      deliver(
        docSubscribedFrame({
          workflow_id: 'wf-b',
          ok: false,
          code: 'not_found'
        })
      )
      vi.advanceTimersByTime(500)
      deliver(docSubscribedFrame({ workflow_id: 'wf-b' }))
      expect(target.serialize()).toMatchObject(loaded)

      const changed = { ...loaded.nodes[0], title: 'Host workflow' }
      if (content === 'new-type') {
        changed.type = removed.type
        changed.widgets_values = ['host value']
      }
      const authoritative =
        content === 'same'
          ? loaded
          : {
              nodes: content === 'empty' ? [] : [changed],
              links: []
            }
      const host = snapshot('wf-b', authoritative)

      expect(target._nodes.map(({ id }) => id)).toEqual(
        authoritative.nodes.map(({ id }) => toNodeId(id))
      )
      expect(target.serialize().links).toEqual(authoritative.links)
      if (content === 'empty') return
      const live = target._nodes[0]
      if (content === 'new-type') {
        expect(live).not.toBe(retained)
        expect(live.constructor).toBe(widgetConstructor)
        expect(retained.graph).toBeNull()
        expect(retained.onRemoved).toHaveBeenCalledOnce()
      } else {
        expect(live).toBe(retained)
      }
      expect(live.title).toBe(authoritative.nodes[0].title)
      expect(live.widgets![0]).toMatchObject({
        name: 'text_widget',
        type: 'text',
        value: content === 'new-type' ? 'host value' : 'local value'
      })

      const widgets = nodesMap(host).get(String(live.id))?.get('widgets')
      assert(widgets instanceof Y.Map, 'missing widgets')
      widgets.set('text_widget', 'remote value')
      deliverUpdate(host, 'wf-b', 2)
      expect(
        useWidgetValueStore().getWidget(
          widgetId(scope.rootGraphId, retained.id, 'text_widget')
        )
      ).toMatchObject({ value: 'remote value' })
      expect(live.widgets![0].value).toBe('remote value')
    }
  )

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
