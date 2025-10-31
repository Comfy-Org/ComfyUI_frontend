import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyApp } from '@/scripts/app'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { TaskItemImpl } from '@/stores/queueStore'
import * as getWorkflowModule from '@/platform/workflow/cloud'

vi.mock('@/platform/distribution/types', () => ({
  isCloud: true
}))

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

const createHistoryTaskWithWorkflow = (): TaskItemImpl => {
  return new TaskItemImpl(
    'History',
    [
      0, // queueIndex
      'test-prompt-id', // promptId
      {}, // promptInputs
      {
        client_id: 'test-client',
        extra_pnginfo: {
          workflow: mockWorkflow
        }
      },
      [] // outputsToExecute
    ],
    {
      status_str: 'success',
      completed: true,
      messages: []
    },
    {} // outputs
  )
}

const createHistoryTaskWithoutWorkflow = (): TaskItemImpl => {
  return new TaskItemImpl(
    'History',
    [
      0,
      'test-prompt-id',
      {},
      {
        client_id: 'test-client'
        // No extra_pnginfo.workflow
      },
      []
    ],
    {
      status_str: 'success',
      completed: true,
      messages: []
    },
    {}
  )
}

describe('TaskItemImpl.loadWorkflow - cloud history workflow fetching', () => {
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

    vi.spyOn(getWorkflowModule, 'getWorkflowFromHistory')
  })

  it('should load workflow directly when workflow is in extra_pnginfo', async () => {
    const task = createHistoryTaskWithWorkflow()

    await task.loadWorkflow(mockApp)

    expect(mockApp.loadGraphData).toHaveBeenCalledWith(mockWorkflow)
    expect(mockFetchApi).not.toHaveBeenCalled()
  })

  it('should fetch workflow from cloud when workflow is missing from history task', async () => {
    const task = createHistoryTaskWithoutWorkflow()

    // Mock getWorkflowFromHistory to return workflow
    vi.spyOn(getWorkflowModule, 'getWorkflowFromHistory').mockResolvedValue(
      mockWorkflow
    )

    await task.loadWorkflow(mockApp)

    expect(getWorkflowModule.getWorkflowFromHistory).toHaveBeenCalledWith(
      expect.any(Function),
      'test-prompt-id'
    )
    expect(mockApp.loadGraphData).toHaveBeenCalledWith(mockWorkflow)
  })

  it('should not load workflow when fetch returns undefined', async () => {
    const task = createHistoryTaskWithoutWorkflow()

    vi.spyOn(getWorkflowModule, 'getWorkflowFromHistory').mockResolvedValue(
      undefined
    )

    await task.loadWorkflow(mockApp)

    expect(getWorkflowModule.getWorkflowFromHistory).toHaveBeenCalled()
    expect(mockApp.loadGraphData).not.toHaveBeenCalled()
  })

  it('should only fetch for history tasks, not running tasks', async () => {
    const runningTask = new TaskItemImpl(
      'Running',
      [
        0,
        'test-prompt-id',
        {},
        {
          client_id: 'test-client'
        },
        []
      ],
      undefined,
      {}
    )

    vi.spyOn(getWorkflowModule, 'getWorkflowFromHistory').mockResolvedValue(
      mockWorkflow
    )

    await runningTask.loadWorkflow(mockApp)

    expect(getWorkflowModule.getWorkflowFromHistory).not.toHaveBeenCalled()
    expect(mockApp.loadGraphData).not.toHaveBeenCalled()
  })

  it('should handle fetch errors gracefully by returning undefined', async () => {
    const task = createHistoryTaskWithoutWorkflow()

    vi.spyOn(getWorkflowModule, 'getWorkflowFromHistory').mockResolvedValue(
      undefined
    )

    await task.loadWorkflow(mockApp)

    expect(getWorkflowModule.getWorkflowFromHistory).toHaveBeenCalled()
    expect(mockApp.loadGraphData).not.toHaveBeenCalled()
  })
})
