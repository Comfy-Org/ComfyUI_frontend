import { vi } from 'vitest'

import type { useWorkflowService as realUseWorkflowService } from '../workflowService'

const workflowService: ReturnType<typeof realUseWorkflowService> = {
  exportWorkflow: vi.fn(async () => {}),
  saveWorkflowAs: vi.fn(async () => true),
  saveWorkflow: vi.fn(async () => true),
  loadDefaultWorkflow: vi.fn(async () => true),
  loadBlankWorkflow: vi.fn(async () => true),
  reloadCurrentWorkflow: vi.fn(async () => {}),
  openWorkflow: vi.fn(async () => true),
  closeWorkflow: vi.fn(async () => true),
  renameWorkflow: vi.fn(async () => true),
  deleteWorkflow: vi.fn(async () => true),
  insertWorkflow: vi.fn(async () => {}),
  loadNextOpenedWorkflow: vi.fn(async () => {}),
  loadPreviousOpenedWorkflow: vi.fn(async () => {}),
  duplicateWorkflow: vi.fn(async () => {}),
  showPendingWarnings: vi.fn(),
  afterLoadNewGraph: vi.fn(async () => {}),
  beforeLoadNewGraph: vi.fn()
}

export const useWorkflowService = vi.fn(() => workflowService)

export const resetWorkflowLoadQueueForTests = vi.fn(() => ({
  pendingLoads: 0,
  closingCount: 0,
  pendingPaths: 0
}))
