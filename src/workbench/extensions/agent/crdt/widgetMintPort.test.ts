import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { reportError } from '@/platform/telemetry/reportError'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import type { WidgetId } from '@/types/widgetId'

import type { DocPromotedWidgets } from './agentSubgraphDefinitions'
import type { GraphOperation } from './graphOperations'
import { createMintSession } from './mintSession'
import type { MintSession } from './mintSession'
import { attachWidgetMintPort } from './widgetMintPort'
import type { WidgetMintPort, WidgetSetView } from './widgetMintPort'

const ROOT = 'root-uuid'

vi.mock('@/platform/telemetry/reportError', () => ({ reportError: vi.fn() }))

function widgetSet(overrides: Partial<WidgetSetView> = {}): WidgetSetView {
  return {
    graphId: ROOT,
    nodeId: '7',
    name: 'seed',
    value: 42,
    old: 3,
    ...overrides
  }
}

describe('attachWidgetMintPort', () => {
  let minted: GraphOperation[]
  let port: WidgetMintPort
  let enabled: boolean
  let bound: boolean
  let root: string | null
  let interiorPaths: Map<string, string[]>
  let session: MintSession
  let listeners: Set<(set: WidgetSetView) => void>
  let rootNodes: Map<string, LGraphNode>
  let docPromotedWidgets: DocPromotedWidgets | null
  let widgetValues: Map<WidgetId, unknown>

  function deliver(set: WidgetSetView): void {
    for (const listener of listeners) listener(set)
  }

  beforeEach(() => {
    minted = []
    enabled = true
    bound = true
    root = ROOT
    interiorPaths = new Map()
    session = createMintSession()
    listeners = new Set()
    rootNodes = new Map()
    docPromotedWidgets = null
    widgetValues = new Map()
    port = attachWidgetMintPort({
      events: {
        onSet: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        }
      },
      session,
      isEnabled: () => enabled,
      isDocBound: () => bound,
      rootGraphId: () => root,
      rootNode: (nodeId) => rootNodes.get(String(nodeId)) ?? null,
      docPromotedWidgets: () => docPromotedWidgets,
      widgetValue: (id) => widgetValues.get(id),
      resolveInteriorPath: (owningGraphId) =>
        interiorPaths.get(owningGraphId) ?? null,
      enqueue: (operations) => minted.push(...operations)
    })
  })

  function promotedHost(names: readonly string[]): LGraphNode {
    return {
      isSubgraphNode: () => true,
      inputs: names.map((name) => ({
        name,
        widgetId: widgetId(ROOT, toNodeId(7), name)
      }))
    } as unknown as LGraphNode
  }

  it('mints a name-keyed top-level set_widget with the old value', () => {
    deliver(widgetSet())

    expect(minted).toEqual([
      { op: 'set_widget', node_id: '7', widget: 'seed', value: 42, old: 3 }
    ])
  })

  it('mints a positional promoted-host write with all live sibling values', () => {
    rootNodes.set('7', promotedHost(['prefix', 'text']))
    docPromotedWidgets = {
      valueCount: 2,
      declaredNames: ['prefix', 'clip', 'text'],
      promotedNames: ['prefix', 'text']
    }
    widgetValues.set(widgetId(ROOT, toNodeId(7), 'prefix'), 'a prefix')

    deliver(widgetSet({ name: 'text', value: 'a pasted prompt' }))

    expect(minted).toEqual([
      {
        op: 'set_widget',
        node_id: '7',
        widget: 'text',
        value: 'a pasted prompt',
        old: 3,
        promoted: {
          value_index: 1,
          instance_path: ['7'],
          host_widgets_values: ['a prefix', 'a pasted prompt']
        }
      }
    ])
  })

  it('seeds the first promoted write in live order when the document declares no definition', () => {
    rootNodes.set('7', promotedHost(['prefix', 'text']))
    docPromotedWidgets = {
      valueCount: 0,
      declaredNames: [],
      promotedNames: undefined
    }

    deliver(widgetSet({ name: 'prefix', value: 'p' }))

    expect(minted).toEqual([
      expect.objectContaining({
        promoted: {
          value_index: 0,
          instance_path: ['7'],
          host_widgets_values: ['p', undefined]
        }
      })
    ])
  })

  it.for([
    {
      name: 'a reordered promoted layout',
      layout: {
        valueCount: 2,
        declaredNames: ['text', 'prefix'],
        promotedNames: ['text', 'prefix']
      }
    },
    {
      name: 'a stored array sized for another layout',
      layout: {
        valueCount: 3,
        declaredNames: ['prefix', 'text'],
        promotedNames: ['prefix', 'text']
      }
    },
    {
      name: 'an empty array whose definition orders differently',
      layout: {
        valueCount: 0,
        declaredNames: ['text', 'prefix'],
        promotedNames: ['text', 'prefix']
      }
    },
    {
      name: 'unreadable definition inputs',
      layout: { valueCount: 2, declaredNames: [], promotedNames: null }
    }
  ])('refuses and reports $name once per host', ({ layout }) => {
    rootNodes.set('7', promotedHost(['prefix', 'text']))
    docPromotedWidgets = layout

    deliver(widgetSet({ name: 'text', value: 'p' }))
    deliver(widgetSet({ name: 'text', value: 'pa' }))

    expect(minted).toEqual([])
    expect(reportError).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'agent_crdt_promoted_widget_order_drift'
      })
    )
  })

  it('drops a subgraph-host widget that is not promoted', () => {
    rootNodes.set('7', promotedHost(['prefix', 'text']))
    docPromotedWidgets = {
      valueCount: 2,
      declaredNames: ['prefix', 'text'],
      promotedNames: ['prefix', 'text']
    }

    deliver(widgetSet({ name: 'extra', value: 'ignored' }))

    expect(minted).toEqual([])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('never mints with the product flag off', () => {
    enabled = false
    deliver(widgetSet())

    expect(minted).toEqual([])
  })

  it('never mints without a bound doc', () => {
    bound = false
    deliver(widgetSet())

    expect(minted).toEqual([])
  })

  it('never mints inside a graph-teardown bracket (restoration writes are inert)', () => {
    session.beginGraphTeardown()
    deliver(widgetSet())
    session.endGraphTeardown()

    expect(minted).toEqual([])
  })

  it('mints an interior set_widget with the resolved node path', () => {
    interiorPaths.set('subgraph-uuid', ['57'])

    deliver(widgetSet({ graphId: 'subgraph-uuid', nodeId: '27' }))

    expect(minted).toEqual([
      {
        op: 'set_widget',
        node_id: '27',
        widget: 'seed',
        value: 42,
        old: 3,
        path: ['57', '27'],
        inner_widget: 'seed'
      }
    ])
  })

  it('surfaces an unresolvable interior write observably instead of minting', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    deliver(widgetSet({ graphId: 'subgraph-uuid' }))

    expect(minted).toEqual([])
    expect(consoleError).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })

  it('surfaces a write with no open root graph observably', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    root = null
    deliver(widgetSet())

    expect(minted).toEqual([])
    expect(consoleError).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })

  it('stops minting after detach', () => {
    port.detach()
    deliver(widgetSet())

    expect(minted).toEqual([])
  })
})
