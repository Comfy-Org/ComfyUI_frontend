import { createTestingPinia } from '@pinia/testing'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  JobDetail,
  JobListItem
} from '@/platform/remote/comfyui/jobs/jobTypes'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyApp } from '@/scripts/app'
import * as jobOutputCache from '@/services/jobOutputCache'
import type { TaskOutput } from '@/schemas/apiSchema'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { TaskItemImpl } from '@/stores/queueStore'
import { createNodeExecutionId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'

vi.mock('@/services/extensionService', () => ({
  useExtensionService: vi.fn(() => ({
    invokeExtensions: vi.fn()
  }))
}))

const mockWorkflow: ComfyWorkflowJSON = {
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
  id: 'test-job-id',
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
    '1': {
      images: [{ filename: 'test.png', subfolder: '', type: 'output' as const }]
    }
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
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()

    mockFetchApi = vi.fn()
    mockApp = fromPartial<ComfyApp>({
      loadGraphData: vi.fn(),
      nodeOutputs: {},
      api: {
        fetchApi: mockFetchApi
      }
    })
  })

  it('should fetch workflow from API for history tasks', async () => {
    const job = createHistoryJob('test-job-id')
    const task = new TaskItemImpl(job)

    vi.spyOn(jobOutputCache, 'getJobDetail').mockResolvedValue(
      mockJobDetail as JobDetail
    )

    await task.loadWorkflow(mockApp)

    expect(jobOutputCache.getJobDetail).toHaveBeenCalledWith('test-job-id')
    expect(mockApp.loadGraphData).toHaveBeenCalledWith(mockWorkflow)
  })

  it('should not load workflow when fetch returns undefined', async () => {
    const job = createHistoryJob('test-job-id')
    const task = new TaskItemImpl(job)

    vi.spyOn(jobOutputCache, 'getJobDetail').mockResolvedValue(undefined)

    await task.loadWorkflow(mockApp)

    expect(jobOutputCache.getJobDetail).toHaveBeenCalled()
    expect(mockApp.loadGraphData).not.toHaveBeenCalled()
  })

  it('should only fetch for history tasks, not running tasks', async () => {
    const job = createRunningJob('test-job-id')
    const runningTask = new TaskItemImpl(job)

    vi.spyOn(jobOutputCache, 'getJobDetail').mockResolvedValue(
      mockJobDetail as JobDetail
    )

    await runningTask.loadWorkflow(mockApp)

    expect(jobOutputCache.getJobDetail).not.toHaveBeenCalled()
    expect(mockApp.loadGraphData).not.toHaveBeenCalled()
  })

  it('should handle fetch errors gracefully by returning undefined', async () => {
    const job = createHistoryJob('test-job-id')
    const task = new TaskItemImpl(job)

    vi.spyOn(jobOutputCache, 'getJobDetail').mockResolvedValue(undefined)

    await task.loadWorkflow(mockApp)

    expect(jobOutputCache.getJobDetail).toHaveBeenCalled()
    expect(mockApp.loadGraphData).not.toHaveBeenCalled()
  })

  it('should load full outputs for history tasks', async () => {
    const job = createHistoryJob('test-job-id')
    const task = new TaskItemImpl(job)
    vi.spyOn(jobOutputCache, 'getJobDetail').mockResolvedValue(
      mockJobDetail as JobDetail
    )

    const loaded = await task.loadFullOutputs()

    expect(loaded).not.toBe(task)
    expect(loaded.flatOutputs[0].filename).toBe('test.png')
  })

  it('should not load full outputs for running tasks', async () => {
    const job = createRunningJob('test-job-id')
    const task = new TaskItemImpl(job)
    const detailSpy = vi.spyOn(jobOutputCache, 'getJobDetail')

    const loaded = await task.loadFullOutputs()

    expect(loaded).toBe(task)
    expect(detailSpy).not.toHaveBeenCalled()
  })

  it('should keep history tasks when full outputs are unavailable', async () => {
    const job = createHistoryJob('test-job-id')
    const task = new TaskItemImpl(job)
    vi.spyOn(jobOutputCache, 'getJobDetail').mockResolvedValue(
      fromPartial<JobDetail>({ id: 'test-job-id', status: 'completed' })
    )

    const loaded = await task.loadFullOutputs()

    expect(loaded).toBe(task)
  })

  it('should load workflow outputs from the task when job detail has none', async () => {
    const job = createHistoryJob('test-job-id')
    const task = new TaskItemImpl(job, mockJobDetail.outputs)
    const nodeOutputStore = useNodeOutputStore()
    const setOutputsSpy = vi.spyOn(
      nodeOutputStore,
      'setNodeOutputsByExecutionId'
    )
    vi.spyOn(jobOutputCache, 'getJobDetail').mockResolvedValue(
      fromPartial<JobDetail>({ ...mockJobDetail, outputs: undefined })
    )

    await task.loadWorkflow(mockApp)

    expect(mockApp.loadGraphData).toHaveBeenCalledWith(mockWorkflow)
    expect(setOutputsSpy).toHaveBeenCalledOnce()
    expect(
      nodeOutputStore.getNodeOutputByExecutionId(
        createNodeExecutionId([toNodeId(1)])
      )
    ).toEqual(mockJobDetail.outputs['1'])
  })

  it('should skip workflow output loading when no outputs exist', async () => {
    const job = createHistoryJob('test-job-id')
    const task = new TaskItemImpl(job, fromAny<TaskOutput, unknown>(null))
    const nodeOutputStore = useNodeOutputStore()
    const setOutputsSpy = vi.spyOn(
      nodeOutputStore,
      'setNodeOutputsByExecutionId'
    )
    vi.spyOn(jobOutputCache, 'getJobDetail').mockResolvedValue(
      fromPartial<JobDetail>({ ...mockJobDetail, outputs: undefined })
    )

    await task.loadWorkflow(mockApp)

    expect(mockApp.loadGraphData).toHaveBeenCalledWith(mockWorkflow)
    expect(setOutputsSpy).not.toHaveBeenCalled()
    expect(nodeOutputStore.nodeOutputs).toEqual({})
  })

  it('should skip invalid node execution ids while loading outputs', async () => {
    const job = createHistoryJob('test-job-id')
    const outputs = fromAny<TaskOutput, unknown>({
      '': { images: [{ filename: 'skip.png', subfolder: '', type: 'output' }] },
      '1': { images: [{ filename: 'keep.png', subfolder: '', type: 'output' }] }
    })
    const task = new TaskItemImpl(job, outputs)
    const nodeOutputStore = useNodeOutputStore()
    const setOutputsSpy = vi.spyOn(
      nodeOutputStore,
      'setNodeOutputsByExecutionId'
    )
    vi.spyOn(jobOutputCache, 'getJobDetail').mockResolvedValue(
      fromPartial<JobDetail>({ ...mockJobDetail, outputs: undefined })
    )

    await task.loadWorkflow(mockApp)

    expect(setOutputsSpy).toHaveBeenCalledOnce()
    expect(setOutputsSpy).toHaveBeenCalledWith('1', outputs['1'])
    expect(
      nodeOutputStore.getNodeOutputByExecutionId(
        createNodeExecutionId([toNodeId(1)])
      )
    ).toEqual(outputs['1'])
    expect(Object.keys(nodeOutputStore.nodeOutputs)).toEqual(['1'])
  })
})
