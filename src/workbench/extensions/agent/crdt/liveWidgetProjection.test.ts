import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { TWidgetType } from '@/lib/litegraph/src/types/widgets'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toNodeId } from '@/types/nodeId'

import type { GraphOperation } from './graphOperations'
import { applyLiveWidgetValue } from './liveWidgetProjection'
import { attachMintPortWiring } from './mintPortWiring'

const rootScope = {
  rootGraphId: toRootGraphId('root'),
  owningGraphId: toOwningGraphId('root')
}
const remoteContext: RemoteMutationContext = {
  source: 'agent-remote',
  actor: 'agent:test',
  opId: 'op-1'
}

function graphWithWidget(type: TWidgetType = 'text') {
  const graph = new LGraph()
  graph.id = 'root'
  const node = new LGraphNode('Test')
  node.id = toNodeId(7)
  const callback = vi.fn()
  const widget = node.addWidget(type, 'value', 'before', callback)
  graph.add(node)
  return { graph, node, widget, callback }
}

describe('applyLiveWidgetValue', () => {
  beforeEach(() =>
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  )

  it('guards a missing graph and identifies the widget in its warning', () => {
    expect(
      applyLiveWidgetValue(
        undefined,
        rootScope,
        toNodeId(7),
        'value',
        'after',
        remoteContext
      )
    ).toBe(false)
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('node 7, widget value: graph is not ready')
    )
  })

  it('guards a missing node or widget', () => {
    const graph = new LGraph()
    graph.id = 'root'
    expect(
      applyLiveWidgetValue(
        graph,
        rootScope,
        toNodeId(7),
        'value',
        'after',
        remoteContext
      )
    ).toBe(false)

    const node = new LGraphNode('Test')
    node.id = toNodeId(7)
    graph.add(node)
    expect(
      applyLiveWidgetValue(
        graph,
        rootScope,
        toNodeId(7),
        'value',
        'after',
        remoteContext
      )
    ).toBe(false)
  })

  it('updates both the widget value and callbacks with the previous value', () => {
    const { graph, node, widget, callback } = graphWithWidget()
    node.onWidgetChanged = vi.fn()

    expect(
      applyLiveWidgetValue(
        graph,
        rootScope,
        toNodeId(7),
        'value',
        'after',
        remoteContext
      )
    ).toBe(true)
    expect(widget.value).toBe('after')
    expect(callback).toHaveBeenCalledWith('after')
    expect(node.onWidgetChanged).toHaveBeenCalledWith(
      'value',
      'after',
      'before',
      widget
    )
  })

  it('skips callback-only widgets', () => {
    const { graph, widget, callback } = graphWithWidget('button')

    expect(
      applyLiveWidgetValue(
        graph,
        rootScope,
        toNodeId(7),
        'value',
        'after',
        remoteContext
      )
    ).toBe(false)
    expect(widget.value).toBe('before')
    expect(callback).not.toHaveBeenCalled()
  })

  it('skips object values for a text widget', () => {
    const { graph, widget, callback } = graphWithWidget('text')

    expect(
      applyLiveWidgetValue(
        graph,
        rootScope,
        toNodeId(7),
        'value',
        { unsupported: true },
        remoteContext
      )
    ).toBe(false)
    expect(widget.value).toBe('before')
    expect(callback).not.toHaveBeenCalled()
  })

  it('rolls back when the widget callback throws', () => {
    const { graph, widget, callback } = graphWithWidget()
    callback.mockImplementation(() => {
      throw new Error('callback failed')
    })

    expect(() =>
      applyLiveWidgetValue(
        graph,
        rootScope,
        toNodeId(7),
        'value',
        'after',
        remoteContext
      )
    ).toThrow('callback failed')
    expect(widget.value).toBe('before')
  })

  it('rolls back when onWidgetChanged throws', () => {
    const { graph, node, widget } = graphWithWidget()
    node.onWidgetChanged = () => {
      throw new Error('node callback failed')
    }

    expect(() =>
      applyLiveWidgetValue(
        graph,
        rootScope,
        toNodeId(7),
        'value',
        'after',
        remoteContext
      )
    ).toThrow('node callback failed')
    expect(widget.value).toBe('before')
  })

  it('suppresses the remote store write but mints a callback-produced edit', () => {
    const { graph, widget } = graphWithWidget()
    const minted: GraphOperation[] = []
    const wiring = attachMintPortWiring({
      isEnabled: () => true,
      isDocBound: () => true,
      enqueue: (operations) => minted.push(...operations),
      layoutChanges: () => () => undefined,
      localActorPrefix: 'user-',
      getGraph: () => graph
    })
    widget.callback = () => {
      widget.value = 'callback edit'
    }

    expect(
      applyLiveWidgetValue(
        graph,
        rootScope,
        toNodeId(7),
        'value',
        'after',
        remoteContext
      )
    ).toBe(true)
    expect(minted).toEqual([
      {
        op: 'set_widget',
        node_id: toNodeId(7),
        widget: 'value',
        value: 'callback edit',
        old: 'after'
      }
    ])
    wiring.detach()
  })

  it('does not mint remote apply or rollback writes', () => {
    const { graph, widget, callback } = graphWithWidget()
    const minted: GraphOperation[] = []
    const wiring = attachMintPortWiring({
      isEnabled: () => true,
      isDocBound: () => true,
      enqueue: (operations) => minted.push(...operations),
      layoutChanges: () => () => undefined,
      localActorPrefix: 'user-',
      getGraph: () => graph
    })
    callback.mockImplementation(() => {
      throw new Error('callback failed')
    })

    expect(() =>
      applyLiveWidgetValue(
        graph,
        rootScope,
        toNodeId(7),
        'value',
        'after',
        remoteContext
      )
    ).toThrow('callback failed')
    expect(widget.value).toBe('before')
    expect(minted).toEqual([])
    wiring.detach()
  })

  it('resolves nodes from the owning subgraph instead of the root graph', () => {
    const graph = new LGraph()
    graph.id = 'root'
    const rootNode = new LGraphNode('Root')
    rootNode.id = toNodeId(8)
    const rootWidget = rootNode.addWidget(
      'text',
      'value',
      'root',
      () => undefined
    )
    graph.add(rootNode)

    const subgraph = createTestSubgraph({ rootGraph: graph })
    graph.subgraphs.set(subgraph.id, subgraph)
    const innerNode = new LGraphNode('Inner')
    innerNode.id = toNodeId(7)
    const innerWidget = innerNode.addWidget(
      'text',
      'value',
      'inner',
      () => undefined
    )
    subgraph.add(innerNode)

    expect(
      applyLiveWidgetValue(
        graph,
        {
          rootGraphId: toRootGraphId('root'),
          owningGraphId: toOwningGraphId(subgraph.id)
        },
        toNodeId(7),
        'value',
        'after',
        remoteContext
      )
    ).toBe(true)
    expect(innerWidget.value).toBe('after')
    expect(rootWidget.value).toBe('root')
  })
})
