import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  JobDetail,
  JobListItem
} from '@/platform/remote/comfyui/jobs/jobTypes'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyApp } from '@/scripts/app'
import { TaskItemImpl } from '@/stores/queueStore'
import * as jobsModule from '@/platform/remote/comfyui/jobs/fetchJobs'

vi.mock('@/services/extensionService', () => ({
  useExtensionService: vi.fn(() => ({
    invokeExtensions: vi.fn()
  }))
}))

const mockWorkflow: ComfyWorkflowJSON = {
  id: 'test-workflow-id',
  revision: 0,
  last_node_id: 5,
  last_link_id: 3,
  nodes: [],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

// Mock job detail response (matches actual /jobs/{id} API response structure)
// workflow is nested at: workflow.extra_data.extra_pnginfo.workflow
const mockJobDetail = {
  id: 'test-prompt-id',
  status: 'completed' as const,
  create_time: Date.now(),
  update_time: Date.now(),
  workflow: {
    extra_data: {
      extra_pnginfo: {
        workflow: mockWorkflow
      }
    }
  },
  outputs: {
    '1': { images: [{ filename: 'test.png', subfolder: '', type: 'output' }] }
  }
}

function createHistoryJob(id: string): JobListItem {
  const now = Date.now()
  return {
    id,
    status: 'completed',
    create_time: now,
    priority: now
  }
}

function createRunningJob(id: string): JobListItem {
  const now = Date.now()
  return {
    id,
    status: 'in_progress',
    create_time: now,
    priority: now
  }
}

describe('TaskItemImpl.loadWorkflow - workflow fetching', () => {
  let mockApp: ComfyApp
  let mockFetchApi: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    mockFetchApi = vi.fn()
    mockApp = {
      loadGraphData: vi.fn(),
      nodeOutputs: {},
      api: {
        fetchApi: mockFetchApi
      }
    } as unknown as ComfyApp
  })

  it('should fetch workflow from API for history tasks', async () => {
    const job = createHistoryJob('test-prompt-id')
    const task = new TaskItemImpl(job)

    vi.spyOn(jobsModule, 'fetchJobDetail').mockResolvedValue(
      mockJobDetail as JobDetail
    )

    await task.loadWorkflow(mockApp)

    expect(jobsModule.fetchJobDetail).toHaveBeenCalledWith(
      expect.any(Function),
      'test-prompt-id'
    )
    expect(mockApp.loadGraphData).toHaveBeenCalledWith(mockWorkflow)
  })

  it('should not load workflow when fetch returns undefined', async () => {
    const job = createHistoryJob('test-prompt-id')
    const task = new TaskItemImpl(job)

    vi.spyOn(jobsModule, 'fetchJobDetail').mockResolvedValue(undefined)

    await task.loadWorkflow(mockApp)

    expect(jobsModule.fetchJobDetail).toHaveBeenCalled()
    expect(mockApp.loadGraphData).not.toHaveBeenCalled()
  })

  it('should only fetch for history tasks, not running tasks', async () => {
    const job = createRunningJob('test-prompt-id')
    const runningTask = new TaskItemImpl(job)

    vi.spyOn(jobsModule, 'fetchJobDetail').mockResolvedValue(
      mockJobDetail as JobDetail
    )

    await runningTask.loadWorkflow(mockApp)

    expect(jobsModule.fetchJobDetail).not.toHaveBeenCalled()
    expect(mockApp.loadGraphData).not.toHaveBeenCalled()
  })

  it('should handle fetch errors gracefully by returning undefined', async () => {
    const job = createHistoryJob('test-prompt-id')
    const task = new TaskItemImpl(job)

    vi.spyOn(jobsModule, 'fetchJobDetail').mockResolvedValue(undefined)

    await task.loadWorkflow(mockApp)

    expect(jobsModule.fetchJobDetail).toHaveBeenCalled()
    expect(mockApp.loadGraphData).not.toHaveBeenCalled()
  })
})
