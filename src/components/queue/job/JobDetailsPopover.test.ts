import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import JobDetailsPopover from '@/components/queue/job/JobDetailsPopover.vue'
import { i18n } from '@/i18n'
import type { JobStatus } from '@/platform/remote/comfyui/jobs/jobTypes'
import { TaskItemImpl, useQueueStore } from '@/stores/queueStore'

vi.mock('@/platform/distribution/types', () => ({
  isCloud: true
}))

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({ copyToClipboard: vi.fn() })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showExecutionErrorDialog: vi.fn(),
    showErrorDialog: vi.fn()
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: null
  })
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => ({
    isJobInitializing: () => false
  })
}))

function createHistoryTask(
  id: string,
  status: JobStatus,
  executionMs: number
): TaskItemImpl {
  const now = Date.now() / 1000
  return new TaskItemImpl({
    id,
    status,
    create_time: now - 100,
    execution_start_time: now - 100,
    execution_end_time: now - 100 + executionMs / 1000,
    priority: 1
  })
}

function renderPopover(task: TaskItemImpl) {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions: false
  })
  const queueStore = useQueueStore(pinia)
  queueStore.historyTasks = [task]

  return render(JobDetailsPopover, {
    props: { jobId: task.jobId, workflowId: 'wf-1' },
    global: {
      plugins: [pinia, i18n],
      stubs: { Button: { template: '<button><slot /></button>' } },
      directives: { tooltip: () => {} }
    }
  })
}

describe('JobDetailsPopover extraRows', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
  })

  it('renders Cancelled after row for a cancelled job and omits the error message section', () => {
    const task = createHistoryTask('job-cancelled', 'cancelled', 1500)
    renderPopover(task)

    expect(screen.getByText('Cancelled after')).toBeTruthy()
    expect(screen.queryByText('Error message')).toBeNull()
    expect(screen.queryByText('Failed after')).toBeNull()
  })

  it('renders Failed after row plus the error message section for a failed job', () => {
    const task = createHistoryTask('job-failed', 'failed', 2500)
    renderPopover(task)

    expect(screen.getByText('Failed after')).toBeTruthy()
    expect(screen.getByText('Error message')).toBeTruthy()
    expect(screen.queryByText('Cancelled after')).toBeNull()
  })

  it('renders completed-state rows for a completed job and omits failed/cancelled rows', () => {
    const task = createHistoryTask('job-completed', 'completed', 4200)
    renderPopover(task)

    expect(screen.getByText('Generated on')).toBeTruthy()
    expect(screen.getByText('Total generation time')).toBeTruthy()
    expect(screen.queryByText('Failed after')).toBeNull()
    expect(screen.queryByText('Cancelled after')).toBeNull()
    expect(screen.queryByText('Error message')).toBeNull()
  })

  it('localizes the compute hours value via queue.jobDetails.computeHoursValue for all terminal states', () => {
    const cases: Array<{ id: string; status: JobStatus }> = [
      { id: 'c1', status: 'completed' },
      { id: 'f1', status: 'failed' },
      { id: 'x1', status: 'cancelled' }
    ]
    for (const { id, status } of cases) {
      const task = createHistoryTask(id, status, 1500)
      const { unmount } = renderPopover(task)
      expect(screen.getByText(/hours$/)).toBeTruthy()
      unmount()
    }
  })
})
