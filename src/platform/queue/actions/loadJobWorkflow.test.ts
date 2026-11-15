import { loadJobWorkflow } from '@/platform/queue/actions/loadJobWorkflow'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { JobDetail, JobListItem } from '@comfyorg/api-client/jobs/jobTypes'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import type { ComfyApp } from '@/scripts/app'
import { provideExtensionService } from '@/platform/extensions/services/extensionServiceAccess'
import * as jobOutputCache from '@/platform/queue/services/jobOutputCache'
import { TaskItemImpl } from '@comfyorg/api-client/jobs/taskItem'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

vi.mock<unknown>(
  import('@/platform/extensions/services/extensionService'),
  () => ({
    useExtensionService: vi.fn(() => ({
      invokeExtensions: vi.fn()
    }))
  })
)

vi.mock(import('@/platform/assets/composables/media/assetMappers'))

provideExtensionService(() => ({ invokeExtensions: vi.fn() }))

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

const mockJobDetail: JobDetail = {
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

describe('loadJobWorkflow', () => {
  let mockApp: ComfyApp
  let mockFetchApi: ReturnType<typeof vi.fn>

  beforeEach(() => {
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
      mockJobDetail
    )

    await loadJobWorkflow(task, mockApp)

    expect(jobOutputCache.getJobDetail).toHaveBeenCalledWith('test-job-id')
    expect(mockApp.loadGraphData).toHaveBeenCalledWith(mockWorkflow)
  })

  it.for([false, true])(
    'restores outputs and notifies extensions only after a successful load: %s',
    async (loaded) => {
      const invokeExtensions = vi.fn()
      provideExtensionService(() => ({ invokeExtensions }))
      vi.mocked(mockApp.loadGraphData).mockResolvedValue(loaded)
      vi.spyOn(jobOutputCache, 'getJobDetail').mockResolvedValue(mockJobDetail)
      const outputStore = useNodeOutputStore()
      const restoreOutputs = vi.spyOn(
        outputStore,
        'setNodeOutputsByExecutionId'
      )

      await loadJobWorkflow(
        new TaskItemImpl(createHistoryJob('test-job-id')),
        mockApp
      )

      expect(restoreOutputs).toHaveBeenCalledTimes(loaded ? 1 : 0)
      expect(invokeExtensions).toHaveBeenCalledTimes(loaded ? 1 : 0)
    }
  )

  it('should not load workflow when fetch returns undefined', async () => {
    const job = createHistoryJob('test-job-id')
    const task = new TaskItemImpl(job)

    vi.spyOn(jobOutputCache, 'getJobDetail').mockResolvedValue(undefined)

    await loadJobWorkflow(task, mockApp)

    expect(jobOutputCache.getJobDetail).toHaveBeenCalled()
    expect(mockApp.loadGraphData).not.toHaveBeenCalled()
  })

  it('should only fetch for history tasks, not running tasks', async () => {
    const job = createRunningJob('test-job-id')
    const runningTask = new TaskItemImpl(job)

    vi.spyOn(jobOutputCache, 'getJobDetail').mockResolvedValue(
      mockJobDetail
    )

    await loadJobWorkflow(runningTask, mockApp)

    expect(jobOutputCache.getJobDetail).not.toHaveBeenCalled()
    expect(mockApp.loadGraphData).not.toHaveBeenCalled()
  })
})
