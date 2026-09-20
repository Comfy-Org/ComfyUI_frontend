import { beforeEach, describe, expect, it, vi } from 'vitest'

import { installErrorClearingHooks } from '@/composables/graph/useErrorClearingHooks'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toNodeId } from '@/types/nodeId'

import { createGraphMutations } from './graphMutations'
import { createLiveWidgetEffectPort } from './liveWidgetEffects'

const context: RemoteMutationContext = {
  source: 'agent-remote',
  actor: 'agent:test',
  opId: 'op-1'
}
const layout = { createNode: () => {}, deleteNodes: () => {} }

function samplerNode(id: number) {
  const node = new LGraphNode('Sampler', 'Sampler')
  node.id = toNodeId(id)
  const callback = vi.fn()
  node.addWidget('number', 'steps', 20, callback, { min: 1, max: 100 })
  return { node, callback }
}

function liveGraph(effectGraph?: () => LGraph) {
  const graph = new LGraph()
  const { node, callback } = samplerNode(1)
  graph.add(node)
  const mutations = createGraphMutations({
    getScope: () => graphScopeOf(graph),
    layout,
    widgets: createLiveWidgetEffectPort({
      getGraph: effectGraph ?? (() => graph),
      getCanvas: () => undefined
    })
  })
  return { graph, node, callback, mutations }
}

function payload(id: number, widgets_values: Record<string, unknown> = {}) {
  return {
    id,
    type: `Type${id}`,
    pos: [0, 0],
    size: [100, 80],
    inputs: [],
    outputs: [],
    widgets_values
  }
}

describe('createLiveWidgetEffectPort', () => {
  beforeEach(() => {
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(false)
  })

  it('runs callback and onWidgetChanged with the applied and previous values', () => {
    const { node, callback, mutations } = liveGraph()
    const onWidgetChanged = vi.fn()
    node.onWidgetChanged = onWidgetChanged

    expect(mutations.setWidget(toNodeId(1), 'steps', 21, context)).toBe(true)

    expect(callback).toHaveBeenCalledWith(21, undefined, node)
    expect(onWidgetChanged).toHaveBeenCalledWith(
      'steps',
      21,
      20,
      node.widgets?.[0]
    )
    expect(node.widgets?.[0]?.value).toBe(21)
  })

  it.for([
    {
      target: 'a store-only node',
      write: (m: Mutations) => {
        m.addNode(payload(2, { steps: 1 }), context)
        return m.setWidget(toNodeId(2), 'steps', 2, context)
      }
    },
    {
      target: 'a widget the live node lacks',
      write: (m: Mutations) => m.setWidget(toNodeId(1), 'extra', 'x', context)
    }
  ])('fires nothing for $target', ({ write }) => {
    const { callback, mutations } = liveGraph()

    expect(write(mutations)).toBe(true)

    expect(callback).not.toHaveBeenCalled()
  })

  it('fires nothing when the displayed root graph is not the scope root', () => {
    const { callback, mutations } = liveGraph(() => new LGraph())

    expect(mutations.setWidget(toNodeId(1), 'steps', 21, context)).toBe(true)

    expect(callback).not.toHaveBeenCalled()
  })

  it('does not hand a replaced node value to its orphaned live node', () => {
    const { node, callback, mutations } = liveGraph()

    expect(
      mutations.batch(context, (batch) => {
        batch.reconcileNode({
          ...payload(1, { steps: 5 }),
          type: 'Replacement'
        })
        batch.setWidget(toNodeId(1), 'steps', 9)
      })
    ).toBe(true)

    expect(callback).not.toHaveBeenCalled()
    expect(node.widgets?.[0]?.value).toBe(20)
  })

  it('resolves each entry at drain time so a callback removing a later node makes it a no-op', () => {
    const { graph, callback, mutations } = liveGraph()
    const second = samplerNode(2)
    graph.add(second.node)
    callback.mockImplementation(() => graph.remove(second.node))

    expect(
      mutations.batch(context, (batch) => {
        batch.setWidget(toNodeId(1), 'steps', 21)
        batch.setWidget(toNodeId(2), 'steps', 22)
      })
    ).toBe(true)

    expect(callback).toHaveBeenCalledOnce()
    expect(second.callback).not.toHaveBeenCalled()
  })

  it('lets an earlier callback read a later widget value committed in the same batch', () => {
    const { graph, callback, mutations } = liveGraph()
    const second = samplerNode(2)
    graph.add(second.node)
    callback.mockImplementation(() => second.node.widgets?.[0]?.value)

    expect(
      mutations.batch(context, (batch) => {
        batch.setWidget(toNodeId(1), 'steps', 21)
        batch.setWidget(toNodeId(2), 'steps', 22)
      })
    ).toBe(true)

    expect(callback).toHaveReturnedWith(22)
  })

  it('clears a required_input_missing error for the written widget', () => {
    const { graph, mutations } = liveGraph()
    installErrorClearingHooks(graph)
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    const store = useExecutionErrorStore()
    store.recordNodeErrors({
      '1': {
        errors: [
          {
            type: 'required_input_missing',
            message: 'steps is required',
            details: '',
            extra_info: { input_name: 'steps' }
          }
        ],
        dependent_outputs: [],
        class_type: 'Sampler'
      }
    })

    expect(mutations.setWidget(toNodeId(1), 'steps', 21, context)).toBe(true)

    expect(store.lastNodeErrors).toBeNull()
  })
})

type Mutations = ReturnType<typeof createGraphMutations>
