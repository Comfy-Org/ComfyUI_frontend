import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useFavoritedWidgetsStore } from '@/stores/workspace/favoritedWidgetsStore'
import { toNodeId } from '@/types/nodeId'

const { mockState } = vi.hoisted(() => ({
  mockState: {
    graph: null as { extra: Record<string, unknown> } | null,
    nodes: {} as Record<string, unknown>,
    setDirty: vi.fn()
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    get rootGraph() {
      return mockState.graph
    }
  }
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: undefined,
    nodeToNodeLocatorId: (node: { id: unknown }) => String(node.id),
    nodeIdToNodeLocatorId: (id: unknown) => String(id)
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ canvas: { setDirty: mockState.setDirty } })
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByLocatorId: (_graph: unknown, id: string) =>
    mockState.nodes[id] ?? null
}))

vi.mock('@/utils/nodeTitleUtil', () => ({
  resolveNodeDisplayName: (node: { title?: string }) => node.title ?? 'Node'
}))

vi.mock('@/i18n', () => ({
  st: (_key: string, fallback: string) => fallback
}))

interface FakeWidget {
  name: string
  label?: string
}

function makeWidget({ name, label }: FakeWidget): IBaseWidget {
  return {
    name,
    label,
    options: {},
    type: 'number',
    y: 0
  } as IBaseWidget
}

function makeNode(id: number, widgets: FakeWidget[] = [], title = 'My Node') {
  const node = new LGraphNode(title)
  node.id = toNodeId(id)
  node.title = title
  node.widgets = widgets.map(makeWidget)
  return node
}

function registerNode(node: { id: unknown }) {
  mockState.nodes[String(node.id)] = node
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockState.graph = { extra: {} }
  mockState.nodes = {}
  mockState.setDirty = vi.fn()
})

describe('favoritedWidgetsStore', () => {
  it('adds a favorite, marks workflow dirty, and persists to graph.extra', () => {
    const store = useFavoritedWidgetsStore()
    const node = makeNode(1, [{ name: 'seed' }])
    registerNode(node)

    store.addFavorite(node, 'seed')

    expect(store.isFavorited(node, 'seed')).toBe(true)
    expect(mockState.setDirty).toHaveBeenCalledWith(true, true)
    expect(mockState.graph?.extra.favoritedWidgets).toEqual({
      favorites: [{ nodeLocatorId: '1', widgetName: 'seed' }]
    })
  })

  it('does not add the same favorite twice', () => {
    const store = useFavoritedWidgetsStore()
    const node = makeNode(1, [{ name: 'seed' }])
    registerNode(node)

    store.addFavorite(node, 'seed')
    const persisted = structuredClone(mockState.graph?.extra.favoritedWidgets)
    const dirtyCalls = mockState.setDirty.mock.calls.length

    store.addFavorite(node, 'seed')

    expect(store.favoritedWidgets).toHaveLength(1)
    expect(mockState.graph?.extra.favoritedWidgets).toEqual(persisted)
    expect(mockState.setDirty).toHaveBeenCalledTimes(dirtyCalls)
  })

  it('removes a favorite and treats removing an absent one as a no-op', () => {
    const store = useFavoritedWidgetsStore()
    const node = makeNode(1, [{ name: 'seed' }])
    registerNode(node)
    store.addFavorite(node, 'seed')
    const persisted = structuredClone(mockState.graph?.extra.favoritedWidgets)
    const dirtyCalls = mockState.setDirty.mock.calls.length

    store.removeFavorite(node, 'missing')
    expect(store.isFavorited(node, 'seed')).toBe(true)
    expect(mockState.graph?.extra.favoritedWidgets).toEqual(persisted)
    expect(mockState.setDirty).toHaveBeenCalledTimes(dirtyCalls)

    store.removeFavorite(node, 'seed')
    expect(store.isFavorited(node, 'seed')).toBe(false)
  })

  it('toggles favorite state in both directions', () => {
    const store = useFavoritedWidgetsStore()
    const node = makeNode(1, [{ name: 'seed' }])
    registerNode(node)

    store.toggleFavorite(node, 'seed')
    expect(store.isFavorited(node, 'seed')).toBe(true)

    store.toggleFavorite(node, 'seed')
    expect(store.isFavorited(node, 'seed')).toBe(false)
  })

  it('resolves a valid favorite to a node/widget with a composed label', () => {
    const store = useFavoritedWidgetsStore()
    const node = makeNode(7, [{ name: 'cfg', label: 'CFG Scale' }], 'KSampler')
    registerNode(node)

    store.addFavorite(node, 'cfg')

    const [resolved] = store.favoritedWidgets
    expect(resolved.label).toBe('KSampler / CFG Scale')
    expect(store.validFavoritedWidgets).toHaveLength(1)
  })

  it('labels favorites whose node was deleted and excludes them from valid', () => {
    const store = useFavoritedWidgetsStore()
    const node = makeNode(2, [{ name: 'seed' }])
    registerNode(node)
    store.addFavorite(node, 'seed')

    delete mockState.nodes['2']

    expect(store.favoritedWidgets[0].label).toContain('(node deleted)')
    expect(store.validFavoritedWidgets).toHaveLength(0)
  })

  it('labels favorites whose widget no longer exists', () => {
    const store = useFavoritedWidgetsStore()
    const node = makeNode(3, [{ name: 'seed' }])
    registerNode(node)
    store.addFavorite(node, 'seed')

    mockState.nodes['3'] = makeNode(3, [], 'My Node')

    expect(store.favoritedWidgets[0].label).toContain('(widget not found)')
  })

  it('prunes invalid favorites while keeping valid ones', () => {
    const store = useFavoritedWidgetsStore()
    const valid = makeNode(1, [{ name: 'seed' }])
    const stale = makeNode(2, [{ name: 'steps' }])
    registerNode(valid)
    registerNode(stale)
    store.addFavorite(valid, 'seed')
    store.addFavorite(stale, 'steps')

    delete mockState.nodes['2']
    store.pruneInvalidFavorites()

    expect(store.favoritedWidgets).toHaveLength(1)
    expect(store.isFavorited(valid, 'seed')).toBe(true)
  })

  it('reorders favorites to match the provided order', () => {
    const store = useFavoritedWidgetsStore()
    const a = makeNode(1, [{ name: 'seed' }])
    const b = makeNode(2, [{ name: 'steps' }])
    registerNode(a)
    registerNode(b)
    store.addFavorite(a, 'seed')
    store.addFavorite(b, 'steps')

    store.reorderFavorites([...store.validFavoritedWidgets].reverse())

    expect(store.favoritedWidgets.map((fw) => fw.nodeLocatorId)).toEqual([
      '2',
      '1'
    ])
  })

  it('clears all favorites', () => {
    const store = useFavoritedWidgetsStore()
    const node = makeNode(1, [{ name: 'seed' }])
    registerNode(node)
    store.addFavorite(node, 'seed')

    store.clearFavorites()

    expect(store.favoritedWidgets).toHaveLength(0)
  })

  it('loads favorites from graph.extra on init, normalizing legacy nodeId entries', () => {
    mockState.graph = {
      extra: {
        favoritedWidgets: {
          favorites: [
            { nodeLocatorId: '1', widgetName: 'seed' },
            { nodeId: 2, widgetName: 'steps' },
            { widgetName: 'no-node' }
          ]
        }
      }
    }
    registerNode(makeNode(1, [{ name: 'seed' }]))
    registerNode(makeNode(2, [{ name: 'steps' }]))

    const store = useFavoritedWidgetsStore()

    expect(store.favoritedWidgets.map((fw) => fw.nodeLocatorId)).toEqual([
      '1',
      '2'
    ])
  })

  it('ignores malformed favorites when loading from graph.extra', () => {
    mockState.graph = {
      extra: {
        favoritedWidgets: {
          favorites: [
            { nodeLocatorId: '1', widgetName: 'seed' },
            { nodeLocatorId: 'bad:locator', widgetName: 'bad-locator' },
            { nodeLocatorId: 42, widgetName: 'number-locator' },
            { nodeLocatorId: '2', widgetName: '' },
            { nodeId: '', widgetName: 'bad-node' },
            null,
            { widgetName: 'missing-node' }
          ]
        }
      }
    }
    registerNode(makeNode(1, [{ name: 'seed' }]))

    const store = useFavoritedWidgetsStore()

    expect(store.favoritedWidgets.map((fw) => fw.nodeLocatorId)).toEqual(['1'])
  })

  it('loads an empty list when the graph is not available', () => {
    mockState.graph = null

    const store = useFavoritedWidgetsStore()

    expect(store.favoritedWidgets).toHaveLength(0)
  })

  it('does not save when pruning already valid favorites', () => {
    const store = useFavoritedWidgetsStore()
    const node = makeNode(1, [{ name: 'seed' }])
    registerNode(node)
    store.addFavorite(node, 'seed')
    const dirtyCalls = mockState.setDirty.mock.calls.length

    store.pruneInvalidFavorites()

    expect(store.favoritedWidgets).toHaveLength(1)
    expect(mockState.setDirty).toHaveBeenCalledTimes(dirtyCalls)
  })

  it('labels existing favorites when the graph is not loaded', () => {
    const node = makeNode(1, [{ name: 'seed' }])
    registerNode(node)
    const store = useFavoritedWidgetsStore()
    store.addFavorite(node, 'seed')

    mockState.graph = null

    expect(store.favoritedWidgets[0].label).toContain('(graph not loaded)')
    store.clearFavorites()
    expect(store.favoritedWidgets).toHaveLength(0)
  })
})
