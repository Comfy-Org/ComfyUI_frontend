import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createGraphMutations } from './graphMutations'
import { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { TWidgetType } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import { inertPlacementPort } from './__fixtures__/inertPlacementPort'
import type { GraphOperation } from './graphOperations'
import {
  applyLiveWidgetValue,
  createLiveWidgetProjection,
  rebindLiveWidgetState
} from './liveWidgetProjection'
import { attachMintPortWiring } from './mintPortWiring'

const reportError = vi.hoisted(() => vi.fn())
vi.mock(import('@/platform/telemetry/reportError'), () => ({ reportError }))

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

function withMintWiring(
  graph: LGraph,
  run: (minted: GraphOperation[]) => void
): void {
  const minted: GraphOperation[] = []
  const wiring = attachMintPortWiring({
    isEnabled: () => true,
    isDocBound: () => true,
    enqueue: (operations) => minted.push(...operations),
    layoutChanges: () => () => undefined,
    localActorPrefix: 'user-',
    getGraph: () => graph,
    boundRootGraphId: () => toRootGraphId(graph.id)
  })
  try {
    run(minted)
  } finally {
    wiring.detach()
  }
}

describe('applyLiveWidgetValue', () => {
  beforeEach(() => reportError.mockReset())

  it('rebinds a live widget to type-changing reconciliation state', () => {
    const graph = new LGraph()
    graph.id = 'root'
    const node = new LGraphNode('Test')
    node.id = toNodeId(7)
    const widget = node.addWidget('number', 'value', 1, null)
    graph.add(node)
    const mutations = createGraphMutations({
      getScope: () => rootScope,
      layout: { createNode: vi.fn(), deleteNodes: vi.fn() },
      placement: inertPlacementPort,
      liveWidgets: {
        rebind: (scope, nodeId, name) =>
          rebindLiveWidgetState(graph, scope, nodeId, name),
        setValue: (scope, nodeId, name, value, context) =>
          applyLiveWidgetValue(graph, scope, nodeId, name, value, context)
      }
    })
    const payload = {
      id: 7,
      type: 'Test',
      widgets_values: { value: 1 }
    }

    expect(
      mutations.batch(remoteContext, (batch) => {
        batch.reconcileNode({
          ...payload,
          widgets_values: { value: 'text' }
        })
      })
    ).toBe(true)

    expect(
      useWidgetValueStore().getWidget(
        widgetId(rootScope.rootGraphId, toNodeId(7), 'value')
      )
    ).toMatchObject({ type: 'string', value: 'text' })
    expect(widget.value).toBe('text')
    expect(
      mutations.setWidget(toNodeId(7), 'value', 'updated', remoteContext)
    ).toBe(true)
    expect(widget.value).toBe('updated')
  })

  it('quietly skips while the graph is not ready', () => {
    expect(
      applyLiveWidgetValue(
        undefined,
        rootScope,
        toNodeId(7),
        'value',
        'after',
        remoteContext
      )
    ).toEqual({ status: 'skipped' })
    expect(reportError).not.toHaveBeenCalled()
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
    ).toEqual({ status: 'skipped' })

    expect(
      applyLiveWidgetValue(
        graph,
        { ...rootScope, owningGraphId: toOwningGraphId('missing-subgraph') },
        toNodeId(7),
        'value',
        'after',
        remoteContext
      )
    ).toEqual({ status: 'skipped' })

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
    ).toEqual({ status: 'skipped' })
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
    ).toEqual({ status: 'applied', resolvedValue: 'after' })
    expect(widget.value).toBe('after')
    expect(callback).toHaveBeenCalledWith('after', undefined, node)
    expect(node.onWidgetChanged).toHaveBeenCalledWith(
      'value',
      'after',
      'before',
      widget
    )
  })

  it('syncs the backing property for property-linked widgets', () => {
    const { graph, node, widget } = graphWithWidget()
    widget.options = { ...widget.options, property: 'mode' }
    node.properties.mode = 'before'

    expect(
      applyLiveWidgetValue(
        graph,
        rootScope,
        toNodeId(7),
        'value',
        'after',
        remoteContext
      )
    ).toEqual({ status: 'applied', resolvedValue: 'after' })
    expect(node.properties.mode).toBe('after')
  })

  it('invokes a custom widget setter once when syncing its property', () => {
    const { graph, node, widget } = graphWithWidget()
    widget.options = { ...widget.options, property: 'mode' }
    node.properties.mode = 'before'
    let liveValue = widget.value
    const setter = vi.fn((value) => {
      liveValue = value
    })
    Object.defineProperty(widget, 'value', {
      configurable: true,
      get: () => liveValue,
      set: setter
    })

    expect(
      applyLiveWidgetValue(
        graph,
        rootScope,
        toNodeId(7),
        'value',
        'after',
        remoteContext
      )
    ).toEqual({ status: 'applied', resolvedValue: 'after' })
    expect(setter).toHaveBeenCalledOnce()
    expect(node.properties.mode).toBe('after')
  })

  it('invokes a custom setter even when its getter already mirrors the store write', () => {
    const { graph, widget } = graphWithWidget()
    const id = widget.widgetId!
    const setter = vi.fn()
    Object.defineProperty(widget, 'value', {
      configurable: true,
      get: () => useWidgetValueStore().getWidget(id)?.value,
      set: setter
    })

    expect(
      applyLiveWidgetValue(
        graph,
        rootScope,
        toNodeId(7),
        'value',
        'after',
        remoteContext
      )
    ).toEqual({ status: 'applied', resolvedValue: 'after' })
    expect(setter).toHaveBeenCalledExactlyOnceWith('after')
  })

  it('creates an undefined backing property and syncs callback edits', () => {
    const { graph, node, widget } = graphWithWidget()
    widget.options = { ...widget.options, property: 'mode' }
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
    ).toEqual({ status: 'applied', resolvedValue: 'callback edit' })
    expect(node.properties.mode).toBe('callback edit')
  })

  it('restores the backing property when the callback rolls back', () => {
    const { graph, node, widget, callback } = graphWithWidget()
    widget.options = { ...widget.options, property: 'mode' }
    node.properties.mode = 'before'
    callback.mockImplementation(() => {
      throw new Error('callback failed')
    })

    expect(
      applyLiveWidgetValue(
        graph,
        rootScope,
        toNodeId(7),
        'value',
        'after',
        remoteContext
      )
    ).toEqual({ status: 'rolledBack', resolvedValue: 'before' })
    expect(node.properties.mode).toBe('before')
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
    ).toEqual({ status: 'skipped' })
    expect(widget.value).toBe('before')
    expect(callback).not.toHaveBeenCalled()
  })

  it('skips widgets excluded from serialization', () => {
    const { graph, widget, callback } = graphWithWidget()
    widget.serialize = false

    expect(
      applyLiveWidgetValue(
        graph,
        rootScope,
        toNodeId(7),
        'value',
        'after',
        remoteContext
      )
    ).toEqual({ status: 'skipped' })
    expect(widget.value).toBe('before')
    expect(callback).not.toHaveBeenCalled()
  })

  it('updates serializable scalar widget types outside the legacy allowlist', () => {
    const { graph, node, widget, callback } = graphWithWidget('color')

    expect(
      applyLiveWidgetValue(
        graph,
        rootScope,
        toNodeId(7),
        'value',
        '#ffffff',
        remoteContext
      )
    ).toEqual({ status: 'applied', resolvedValue: '#ffffff' })
    expect(widget.value).toBe('#ffffff')
    expect(callback).toHaveBeenCalledWith('#ffffff', undefined, node)
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
    ).toEqual({ status: 'skipped' })
    expect(widget.value).toBe('before')
    expect(callback).not.toHaveBeenCalled()
  })

  it('rolls back when the widget callback throws', () => {
    const { graph, widget, callback } = graphWithWidget()
    callback.mockImplementation(() => {
      throw new Error('callback failed')
    })

    expect(
      applyLiveWidgetValue(
        graph,
        rootScope,
        toNodeId(7),
        'value',
        'after',
        remoteContext
      )
    ).toEqual({ status: 'rolledBack', resolvedValue: 'before' })
    expect(widget.value).toBe('before')
  })

  it('rolls back when onWidgetChanged throws', () => {
    const { graph, node, widget } = graphWithWidget()
    node.onWidgetChanged = () => {
      throw new Error('node callback failed')
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
    ).toEqual({ status: 'rolledBack', resolvedValue: 'before' })
    expect(widget.value).toBe('before')
  })

  it('rolls back when the initial store write throws', () => {
    const { graph, widget } = graphWithWidget()
    vi.spyOn(useWidgetValueStore(), 'setValue').mockImplementationOnce(() => {
      throw new Error('store write failed')
    })

    expect(
      applyLiveWidgetValue(
        graph,
        rootScope,
        toNodeId(7),
        'value',
        'after',
        remoteContext
      )
    ).toEqual({ status: 'rolledBack', resolvedValue: 'before' })
    expect(widget.value).toBe('before')
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'store write failed' }),
      expect.objectContaining({
        errorType: 'agent_live_widget_projection_failed'
      })
    )
  })

  it('suppresses the remote store write but mints a callback-produced edit', () => {
    const { graph, widget } = graphWithWidget()
    widget.callback = () => {
      widget.value = 'callback edit'
    }

    withMintWiring(graph, (minted) => {
      expect(
        applyLiveWidgetValue(
          graph,
          rootScope,
          toNodeId(7),
          'value',
          'after',
          remoteContext
        )
      ).toEqual({ status: 'applied', resolvedValue: 'callback edit' })
      expect(minted).toEqual([
        {
          op: 'set_widget',
          node_id: toNodeId(7),
          widget: 'value',
          value: 'callback edit',
          old: 'after'
        }
      ])
    })
  })

  it('mints a callback-produced edit to a sibling widget', () => {
    const { graph, node, widget } = graphWithWidget()
    const sibling = node.addWidget('text', 'sibling', 'before', null)
    widget.callback = () => {
      sibling.value = 'callback edit'
    }

    withMintWiring(graph, (minted) => {
      expect(
        applyLiveWidgetValue(
          graph,
          rootScope,
          toNodeId(7),
          'value',
          'after',
          remoteContext
        )
      ).toEqual({ status: 'applied', resolvedValue: 'after' })
      expect(minted).toEqual([
        {
          op: 'set_widget',
          node_id: toNodeId(7),
          widget: 'sibling',
          value: 'callback edit',
          old: 'before'
        }
      ])
    })
  })

  it('restores a sibling edit when the callback later throws', () => {
    const { graph, node, widget } = graphWithWidget()
    const sibling = node.addWidget('text', 'sibling', 'before', null)
    widget.callback = () => {
      sibling.value = 'callback edit'
      throw new Error('callback failed')
    }

    withMintWiring(graph, (minted) => {
      expect(
        applyLiveWidgetValue(
          graph,
          rootScope,
          toNodeId(7),
          'value',
          'after',
          remoteContext
        )
      ).toEqual({ status: 'rolledBack', resolvedValue: 'before' })
      expect(widget.value).toBe('before')
      expect(sibling.value).toBe('before')
      expect(minted).toEqual([])
    })
  })

  it('restores an edit to another node when the callback later throws', () => {
    const { graph, widget } = graphWithWidget()
    const otherNode = new LGraphNode('Other')
    otherNode.id = toNodeId(8)
    const otherWidget = otherNode.addWidget('text', 'other', 'before', null)
    graph.add(otherNode)
    widget.callback = () => {
      otherWidget.value = 'callback edit'
      throw new Error('callback failed')
    }

    withMintWiring(graph, (minted) => {
      expect(
        applyLiveWidgetValue(
          graph,
          rootScope,
          toNodeId(7),
          'value',
          'after',
          remoteContext
        )
      ).toEqual({ status: 'rolledBack', resolvedValue: 'before' })
      expect(otherWidget.value).toBe('before')
      expect(minted).toEqual([])
    })
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
    ).toEqual({ status: 'applied', resolvedValue: 'after' })
    expect(innerWidget.value).toBe('after')
    expect(rootWidget.value).toBe('root')
  })

  it('adapts live projection to canvas invalidation', () => {
    const { graph, widget } = graphWithWidget()
    const markDirty = vi.fn()
    const projection = createLiveWidgetProjection({
      getRootGraph: () => graph,
      getCanvas: () => undefined,
      markDirty
    })

    expect(
      projection.setValue(
        rootScope,
        toNodeId(7),
        'value',
        'after',
        remoteContext
      )
    ).toEqual({ status: 'applied', resolvedValue: 'after' })
    expect(widget.value).toBe('after')
    expect(markDirty).toHaveBeenCalledOnce()
  })
})
