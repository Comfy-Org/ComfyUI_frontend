import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import { useAdvancedWidgetOverridesStore } from '@/stores/workspace/advancedWidgetOverridesStore'

const mockGraph = {
  extra: {} as Record<string, unknown>,
  nodes: [] as LGraphNode[]
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
  widgets: Array<{ name: string; options?: IWidgetOptions<unknown> }>
) {
  return { id, widgets } as Partial<LGraphNode> as LGraphNode
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

    expect(store.getAdvancedState(node, node.widgets![0])).toBe(true)

    const node2 = makeNode(2, [{ name: 'cfg' }])
    expect(store.getAdvancedState(node2, node2.widgets![0])).toBe(false)
  })

  it('override to advanced takes precedence over backend', () => {
    const store = useAdvancedWidgetOverridesStore()
    const node = makeNode(1, [{ name: 'cfg' }])

    store.setAdvanced(node, 'cfg', true)

    expect(store.getAdvancedState(node, node.widgets![0])).toBe(true)
    expect(store.isOverridden(node, 'cfg')).toBe(true)
  })

  it('override to non-advanced takes precedence over backend', () => {
    const store = useAdvancedWidgetOverridesStore()
    const node = makeNode(1, [{ name: 'steps', options: { advanced: true } }])

    store.setAdvanced(node, 'steps', false)

    expect(store.getAdvancedState(node, node.widgets![0])).toBe(false)
    expect(store.isOverridden(node, 'steps')).toBe(true)
  })

  it('clearOverride reverts to backend default', () => {
    const store = useAdvancedWidgetOverridesStore()
    const node = makeNode(1, [{ name: 'steps', options: { advanced: true } }])

    store.setAdvanced(node, 'steps', false)
    expect(store.getAdvancedState(node, node.widgets![0])).toBe(false)

    store.clearOverride(node, 'steps')
    expect(store.getAdvancedState(node, node.widgets![0])).toBe(true)
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

    const stored = mockGraph.extra.advancedWidgetOverrides as {
      overrides: Array<{
        nodeLocatorId: string
        widgetName: string
        advanced: boolean
      }>
    }
    expect(stored.overrides).toHaveLength(1)
    expect(stored.overrides[0]).toEqual({
      nodeLocatorId: 'node-1',
      widgetName: 'cfg',
      advanced: true
    })
  })

  it('loads overrides from workflow.extra', async () => {
    mockGraph.extra = {
      advancedWidgetOverrides: {
        overrides: [
          { nodeLocatorId: 'node-1', widgetName: 'cfg', advanced: true },
          { nodeLocatorId: 'node-2', widgetName: 'steps', advanced: false }
        ]
      }
    }

    const store = useAdvancedWidgetOverridesStore()
    await nextTick()

    const node1 = makeNode(1, [{ name: 'cfg' }])
    expect(store.getAdvancedState(node1, node1.widgets![0])).toBe(true)

    const node2 = makeNode(2, [{ name: 'steps', options: { advanced: true } }])
    expect(store.getAdvancedState(node2, node2.widgets![0])).toBe(false)
  })

  it('clearAllOverrides removes everything', () => {
    const store = useAdvancedWidgetOverridesStore()
    const node = makeNode(1, [{ name: 'cfg' }])

    store.setAdvanced(node, 'cfg', true)
    expect(store.isOverridden(node, 'cfg')).toBe(true)

    store.clearAllOverrides()
    expect(store.isOverridden(node, 'cfg')).toBe(false)

    const stored = mockGraph.extra.advancedWidgetOverrides as {
      overrides: unknown[]
    }
    expect(stored.overrides).toHaveLength(0)
  })

  it('pruneInvalidOverrides removes stale entries', () => {
    const store = useAdvancedWidgetOverridesStore()
    const node = makeNode(1, [{ name: 'cfg' }, { name: 'steps' }])

    store.setAdvanced(node, 'cfg', true)
    store.setAdvanced(node, 'steps', true)
    expect(store.isOverridden(node, 'cfg')).toBe(true)
    expect(store.isOverridden(node, 'steps')).toBe(true)

    // Simulate node having only 'cfg' widget now
    mockGraph.nodes = [makeNode(1, [{ name: 'cfg' }])]

    store.pruneInvalidOverrides()
    expect(store.isOverridden(node, 'cfg')).toBe(true)
    expect(store.isOverridden(node, 'steps')).toBe(false)

    const stored = mockGraph.extra.advancedWidgetOverrides as {
      overrides: Array<{
        nodeLocatorId: string
        widgetName: string
        advanced: boolean
      }>
    }
    expect(stored.overrides).toHaveLength(1)
    expect(stored.overrides[0]).toEqual({
      nodeLocatorId: 'node-1',
      widgetName: 'cfg',
      advanced: true
    })
  })
})
