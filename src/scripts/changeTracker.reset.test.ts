import { describe, expect, it, vi } from 'vitest'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

const mockWorkflowStore = vi.hoisted(() => ({
  getWorkflowByPath: vi.fn()
}))

vi.mock('@/scripts/api', () => ({
  api: {
    dispatchCustomEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => mockWorkflowStore)
}))

import { api } from '@/scripts/api'
import { ChangeTracker } from '@/scripts/changeTracker'

function createState(nodeCount: number): ComfyWorkflowJSON {
  return {
    nodes: Array.from({ length: nodeCount }, (_, index) => ({
      id: index + 1,
      type: 'TestNode',
      pos: [0, 0],
      size: [100, 50],
      flags: {},
      order: index,
      mode: 0,
      inputs: [],
      outputs: [],
      properties: {}
    })),
    links: [],
    groups: [],
    extra: {},
    config: {},
    version: 0.4,
    last_node_id: nodeCount,
    last_link_id: 0
  } as ComfyWorkflowJSON
}

describe('ChangeTracker.reset', () => {
  it('clears a stale modified flag without dispatching a graph change', () => {
    const initial = createState(1)
    const changed = structuredClone(initial)
    changed.nodes[0].widgets_values = [2]
    const workflow = { path: '/test/workflow.json' } as never
    const tracker = new ChangeTracker(workflow, initial)
    tracker.activeState = changed
    const workflowRecord = { isModified: true }
    mockWorkflowStore.getWorkflowByPath.mockReturnValue(workflowRecord)

    tracker.reset()

    expect(workflowRecord.isModified).toBe(false)
    expect(api.dispatchCustomEvent).not.toHaveBeenCalled()
  })
})
