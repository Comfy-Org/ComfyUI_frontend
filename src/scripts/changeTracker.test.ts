import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { ChangeTracker } from './changeTracker'

vi.mock('@/scripts/app', () => ({
  app: {
    graph: {},
    rootGraph: { serialize: () => ({ nodes: [], links: [] }) },
    canvas: { ds: { scale: 1, offset: [0, 0] } }
  }
}))
vi.mock('@/scripts/api', () => ({
  api: {
    dispatchCustomEvent: vi.fn(),
    apiURL: vi.fn((path: string) => path)
  }
}))
vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({ getWorkflowByPath: () => null })
}))
vi.mock('@/stores/subgraphNavigationStore', () => ({
  useSubgraphNavigationStore: () => ({ exportState: () => [] })
}))

describe('ChangeTracker', () => {
  let tracker: ChangeTracker

  beforeEach(() => {
    const mockWorkflow = { path: 'test.json' } as unknown as ComfyWorkflow
    const initialState = {
      version: 1,
      nodes: [],
      links: [],
      last_node_id: 0,
      last_link_id: 0
    } as unknown as ComfyWorkflowJSON
    tracker = new ChangeTracker(mockWorkflow, initialState)
  })

  describe('beforeChange / afterChange batching', () => {
    it('calls checkState only when outermost afterChange completes', () => {
      const checkStateSpy = vi.spyOn(tracker, 'checkState')

      tracker.beforeChange()
      tracker.afterChange()

      expect(checkStateSpy).toHaveBeenCalledOnce()
    })

    it('suppresses checkState for nested calls until fully unwound', () => {
      const checkStateSpy = vi.spyOn(tracker, 'checkState')

      tracker.beforeChange()
      tracker.beforeChange()

      tracker.afterChange()
      expect(checkStateSpy).not.toHaveBeenCalled()

      tracker.afterChange()
      expect(checkStateSpy).toHaveBeenCalledOnce()
    })
  })
})
