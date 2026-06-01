import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as DistributionTypes from '@/platform/distribution/types'
import { useExecutionStore } from '@/stores/executionStore'

const { mockTrackExecutionSuccess, mockTrackExecutionError } = vi.hoisted(
  () => ({
    mockTrackExecutionSuccess: vi.fn(),
    mockTrackExecutionError: vi.fn()
  })
)

vi.mock('@/platform/distribution/types', async (importOriginal) => ({
  ...(await importOriginal<typeof DistributionTypes>()),
  isCloud: true
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackExecutionSuccess: mockTrackExecutionSuccess,
    trackExecutionError: mockTrackExecutionError
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => ({
    nodeLocatorIdToNodeExecutionId: vi.fn(),
    executionIdToCurrentId: vi.fn()
  }))
}))

type EventHandler = (...args: unknown[]) => void
const apiEventHandlers = new Map<string, EventHandler>()
vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn((event: string, handler: EventHandler) => {
      apiEventHandlers.set(event, handler)
    }),
    removeEventListener: vi.fn((event: string) => {
      apiEventHandlers.delete(event)
    }),
    clientId: 'test-client'
  }
}))

vi.mock('@/scripts/app', () => ({
  app: { rootGraph: { getNodeById: vi.fn(), nodes: [] } }
}))

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({ revokePreviewsByExecutionId: vi.fn() })
}))

vi.mock('@/stores/jobPreviewStore', () => ({
  useJobPreviewStore: () => ({ clearPreview: vi.fn() })
}))

vi.mock('@/composables/node/useNodeProgressText', () => ({
  useNodeProgressText: () => ({ showTextPreview: vi.fn() })
}))

function createPromptNode(title: string, classType: string) {
  return {
    inputs: {},
    class_type: classType,
    _meta: { title }
  }
}

function createWorkflow(id: string) {
  return {
    activeState: { id },
    initialState: { id },
    path: `/workflows/${id}.json`
  } as unknown as Parameters<
    ReturnType<typeof useExecutionStore>['storeJob']
  >[0]['workflow']
}

describe('useExecutionStore - App Mode execution attribution', () => {
  let store: ReturnType<typeof useExecutionStore>

  function fire<T>(event: string, detail: T) {
    const handler = apiEventHandlers.get(event)
    if (!handler) throw new Error(`${event} handler not bound`)
    handler(new CustomEvent(event, { detail }))
  }

  function queueJob(
    id: string,
    workflowId: string,
    isAppMode: boolean,
    viewMode?: string
  ) {
    store.storeJob({
      id,
      nodes: ['a'],
      promptOutput: { a: createPromptNode('A', 'X') },
      workflow: createWorkflow(workflowId),
      isAppMode,
      viewMode
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    apiEventHandlers.clear()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
    store.bindExecutionEvents()
  })

  it('attributes execution_success to App Mode with the workflow id and view mode', () => {
    queueJob('job-1', 'wf-1', true, 'app')
    fire('execution_start', { prompt_id: 'job-1', timestamp: 0 })

    fire('execution_success', { prompt_id: 'job-1', timestamp: 0 })

    expect(mockTrackExecutionSuccess).toHaveBeenCalledWith({
      jobId: 'job-1',
      is_app_mode: true,
      workflow_id: 'wf-1',
      view_mode: 'app'
    })
  })

  it('marks non-App-Mode runs as is_app_mode false', () => {
    queueJob('job-2', 'wf-2', false, 'graph')
    fire('execution_start', { prompt_id: 'job-2', timestamp: 0 })

    fire('execution_success', { prompt_id: 'job-2', timestamp: 0 })

    expect(mockTrackExecutionSuccess).toHaveBeenCalledWith({
      jobId: 'job-2',
      is_app_mode: false,
      workflow_id: 'wf-2',
      view_mode: 'graph'
    })
  })

  it('attributes execution_error to App Mode with the workflow id', () => {
    queueJob('job-3', 'wf-3', true, 'app')

    fire('execution_error', {
      prompt_id: 'job-3',
      node_id: 'n1',
      node_type: 'KSampler',
      exception_message: 'CUDA OOM',
      traceback: []
    })

    expect(mockTrackExecutionError).toHaveBeenCalledWith({
      jobId: 'job-3',
      nodeId: 'n1',
      nodeType: 'KSampler',
      error: 'CUDA OOM',
      is_app_mode: true,
      workflow_id: 'wf-3',
      view_mode: 'app'
    })
  })

  it('distinguishes builder-preview runs from app runs via view_mode', () => {
    queueJob('job-4', 'wf-4', true, 'builder:arrange')
    fire('execution_start', { prompt_id: 'job-4', timestamp: 0 })

    fire('execution_success', { prompt_id: 'job-4', timestamp: 0 })

    expect(mockTrackExecutionSuccess).toHaveBeenCalledWith({
      jobId: 'job-4',
      is_app_mode: true,
      workflow_id: 'wf-4',
      view_mode: 'builder:arrange'
    })
  })
})
