import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAdvancedWidgetOverridesStore } from '@/stores/workspace/advancedWidgetOverridesStore'

const mockGraph = {
  extra: {} as Record<string, unknown>,
  nodes: [] as Array<{ id: number; widgets: Array<{ name: string }> }>
}

vi.mock('@/scripts/app', () => ({
  app: {
    get rootGraph() {
      return mockGraph
    }
  }
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: { path: 'test-workflow' },
    nodeToNodeLocatorId: (node: { id: number }) => `node-${node.id}`
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: { setDirty: vi.fn() }
  })
}))

function makeNode(
  id: number,
  widgets: Array<{ name: string; options?: Record<string, unknown> }>
) {
  return { id, widgets } as any
}

describe('useAdvancedWidgetOverridesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGraph.extra = {}
    mockGraph.nodes = []
  })

  it('returns backend value when no override exists', () => {
    const store = useAdvancedWidgetOverridesStore()
    const node = makeNode(1, [{ name: 'steps', options: { advanced: true } }])

    expect(store.getAdvancedState(node, node.widgets[0])).toBe(true)

    const node2 = makeNode(2, [{ name: 'cfg' }])
    expect(store.getAdvancedState(node2, node2.widgets[0])).toBe(false)
  })

  it('override to advanced takes precedence over backend', () => {
    const store = useAdvancedWidgetOverridesStore()
    const node = makeNode(1, [{ name: 'cfg' }])

    store.setAdvanced(node, 'cfg', true)

    expect(store.getAdvancedState(node, node.widgets[0])).toBe(true)
    expect(store.isOverridden(node, 'cfg')).toBe(true)
  })

  it('override to non-advanced takes precedence over backend', () => {
    const store = useAdvancedWidgetOverridesStore()
    const node = makeNode(1, [{ name: 'steps', options: { advanced: true } }])

    store.setAdvanced(node, 'steps', false)

    expect(store.getAdvancedState(node, node.widgets[0])).toBe(false)
    expect(store.isOverridden(node, 'steps')).toBe(true)
  })

  it('clearOverride reverts to backend default', () => {
    const store = useAdvancedWidgetOverridesStore()
    const node = makeNode(1, [{ name: 'steps', options: { advanced: true } }])

    store.setAdvanced(node, 'steps', false)
    expect(store.getAdvancedState(node, node.widgets[0])).toBe(false)

    store.clearOverride(node, 'steps')
    expect(store.getAdvancedState(node, node.widgets[0])).toBe(true)
    expect(store.isOverridden(node, 'steps')).toBe(false)
  })

  it('hasAnyAdvanced reflects overrides', () => {
    const store = useAdvancedWidgetOverridesStore()
    const node = makeNode(1, [{ name: 'cfg' }, { name: 'steps' }])

    expect(store.hasAnyAdvanced(node)).toBe(false)

    store.setAdvanced(node, 'cfg', true)
    expect(store.hasAnyAdvanced(node)).toBe(true)
  })

  it('persists overrides to workflow.extra', () => {
    const store = useAdvancedWidgetOverridesStore()
    const node = makeNode(1, [{ name: 'cfg' }])

    store.setAdvanced(node, 'cfg', true)

    const stored = mockGraph.extra.advancedWidgetOverrides as any
    expect(stored.overrides).toHaveLength(1)
    expect(stored.overrides[0]).toEqual({
      nodeLocatorId: 'node-1',
      widgetName: 'cfg',
      advanced: true
    })
  })

  it('loads overrides from workflow.extra', () => {
    mockGraph.extra = {
      advancedWidgetOverrides: {
        overrides: [
          { nodeLocatorId: 'node-1', widgetName: 'cfg', advanced: true },
          { nodeLocatorId: 'node-2', widgetName: 'steps', advanced: false }
        ]
      }
    }

    const store = useAdvancedWidgetOverridesStore()
    store.loadFromWorkflow()

    const node1 = makeNode(1, [{ name: 'cfg' }])
    expect(store.getAdvancedState(node1, node1.widgets[0])).toBe(true)

    const node2 = makeNode(2, [{ name: 'steps', options: { advanced: true } }])
    expect(store.getAdvancedState(node2, node2.widgets[0])).toBe(false)
  })

  it('clearAllOverrides removes everything', () => {
    const store = useAdvancedWidgetOverridesStore()
    const node = makeNode(1, [{ name: 'cfg' }])

    store.setAdvanced(node, 'cfg', true)
    expect(store.overrides.size).toBe(1)

    store.clearAllOverrides()
    expect(store.overrides.size).toBe(0)
  })

  it('pruneInvalidOverrides removes stale entries', () => {
    const store = useAdvancedWidgetOverridesStore()
    const node = makeNode(1, [{ name: 'cfg' }, { name: 'steps' }])

    store.setAdvanced(node, 'cfg', true)
    store.setAdvanced(node, 'steps', true)
    expect(store.overrides.size).toBe(2)

    // Simulate node having only 'cfg' widget now
    mockGraph.nodes = [{ id: 1, widgets: [{ name: 'cfg' }] }] as any

    store.pruneInvalidOverrides()
    expect(store.overrides.size).toBe(1)
    expect(store.isOverridden(node, 'cfg')).toBe(true)
    expect(store.isOverridden(node, 'steps')).toBe(false)
  })
})
