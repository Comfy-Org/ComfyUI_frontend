import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFavoritedWidgetsStore } from '@/stores/workspace/favoritedWidgetsStore'

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
    nodeToNodeLocatorId: (node: { id: number | string }) => String(node.id),
    nodeIdToNodeLocatorId: (id: number | string) => String(id)
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

function makeNode(id: number, widgets: FakeWidget[] = [], title = 'My Node') {
  return { id, title, widgets } as never
}

function registerNode(node: { id: number }) {
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
    store.addFavorite(node, 'seed')

    expect(store.favoritedWidgets).toHaveLength(1)
  })

  it('removes a favorite and treats removing an absent one as a no-op', () => {
    const store = useFavoritedWidgetsStore()
    const node = makeNode(1, [{ name: 'seed' }])
    registerNode(node)
    store.addFavorite(node, 'seed')

    store.removeFavorite(node, 'missing')
    expect(store.isFavorited(node, 'seed')).toBe(true)

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

  it('treats a missing graph as no favorites without throwing', () => {
    mockState.graph = null
    const store = useFavoritedWidgetsStore()

    expect(store.favoritedWidgets).toHaveLength(0)
    expect(() => store.clearFavorites()).not.toThrow()
  })
})
