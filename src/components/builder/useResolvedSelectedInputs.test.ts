import { createTestingPinia } from '@pinia/testing'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import { app } from '@/scripts/app'
import { useAppModeStore } from '@/stores/appModeStore'
import type { WidgetId } from '@/types/widgetId'

import { useResolvedSelectedInputs } from './useResolvedSelectedInputs'

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: {
      id: '11111111-1111-4111-8111-111111111111',
      nodes: [] as LGraphNode[],
      events: new EventTarget(),
      getNodeById: vi.fn() as (id: number) => LGraphNode | null
    }
  }
}))

const rootGraphId = '11111111-1111-4111-8111-111111111111'
const entitySeed = `${rootGraphId}:1:seed` as WidgetId

function makeNode(id: number, widgetNames: string[]): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    id,
    inputs: [],
    isSubgraphNode: () => false,
    widgets: widgetNames.map((name) => ({
      name,
      widgetId: `${rootGraphId}:${id}:${name}` as WidgetId
    }))
  })
}

function makeSubgraphNode(id: number, inputs: INodeInputSlot[]): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    id,
    inputs,
    isSubgraphNode: () => true,
    widgets: []
  })
}

function setRootGraphNodes(nodes: LGraphNode[]) {
  vi.mocked(app.rootGraph).nodes = nodes
  vi.mocked(app.rootGraph).getNodeById = vi.fn(
    (id) => nodes.find((n) => String(n.id) === String(id)) ?? null
  )
}

function dispatchRootGraphEvent(type: string) {
  ;(app.rootGraph!.events as unknown as EventTarget).dispatchEvent(
    new Event(type)
  )
}

describe('useResolvedSelectedInputs', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    setRootGraphNodes([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('re-resolves selections after a convert-to-subgraph event removes nodes from the root graph', () => {
    const node = makeNode(1, ['seed'])
    setRootGraphNodes([node])

    const appModeStore = useAppModeStore()
    appModeStore.selectedInputs = [[entitySeed, 'seed']]

    const resolved = useResolvedSelectedInputs()
    expect(resolved.value[0]?.status).toBe('resolved')

    setRootGraphNodes([])
    dispatchRootGraphEvent('convert-to-subgraph')

    expect(resolved.value[0]?.status).toBe('unknown')
  })

  it('re-resolves selections after a subgraph-created event removes nodes from the root graph', () => {
    const node = makeNode(1, ['seed'])
    setRootGraphNodes([node])

    const appModeStore = useAppModeStore()
    appModeStore.selectedInputs = [[entitySeed, 'seed']]

    const resolved = useResolvedSelectedInputs()
    expect(resolved.value[0]?.status).toBe('resolved')

    setRootGraphNodes([])
    dispatchRootGraphEvent('subgraph-created')

    expect(resolved.value[0]?.status).toBe('unknown')
  })

  it('resolves promoted subgraph inputs from their host input widgetId', () => {
    const node = makeSubgraphNode(1, [
      fromPartial<INodeInputSlot>({
        name: 'seed',
        label: 'renamed_seed',
        widgetId: entitySeed
      })
    ])
    setRootGraphNodes([node])

    const appModeStore = useAppModeStore()
    appModeStore.selectedInputs = [[entitySeed, 'seed']]

    const resolved = useResolvedSelectedInputs()

    expect(resolved.value[0]).toMatchObject({
      status: 'resolved',
      node,
      displayName: 'seed',
      widget: { name: 'seed', label: 'renamed_seed', widgetId: entitySeed }
    })
  })
})
