import { fromPartial } from '@total-typescript/shoehorn'
import { vi } from 'vitest'

import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { ChangeTracker } from '@/scripts/changeTracker'

/**
 * Creates a mock ChangeTracker for workflow testing
 * The ChangeTracker requires a proper ComfyWorkflowJSON structure
 */
export function createMockChangeTracker(
  overrides: Partial<ChangeTracker> = {}
): ChangeTracker {
  const partial = {
    initialState: {
      last_node_id: 0,
      last_link_id: 0,
      nodes: [],
      links: [],
      groups: [],
      config: {},
      version: 0.4
    },
    activeState: {
      last_node_id: 0,
      last_link_id: 0,
      nodes: [],
      links: [],
      groups: [],
      config: {},
      version: 0.4
    },
    undoQueue: [],
    redoQueue: [],
    changeCount: 0,
    beforeChange: vi.fn(),
    afterChange: vi.fn(),
    captureCanvasState: vi.fn(),
    checkState: vi.fn(),
    deactivate: vi.fn(),
    prepareForSave: vi.fn(),
    reset: vi.fn(),
    restore: vi.fn(),
    store: vi.fn(),
    ...overrides
  }
  return partial as Partial<ChangeTracker> as ChangeTracker
}

/**
 * Creates a mock LoadedComfyWorkflow with sensible defaults
 */
export function createMockLoadedWorkflow(
  overrides: Partial<LoadedComfyWorkflow> | Record<string, unknown> = {}
): LoadedComfyWorkflow {
  return fromPartial<LoadedComfyWorkflow>({
    changeTracker: createMockChangeTracker(),
    ...overrides
  })
}
