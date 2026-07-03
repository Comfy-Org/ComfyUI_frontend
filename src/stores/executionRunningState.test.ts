import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useExecutionStore } from '@/stores/executionStore'
import { createTestWorkflow } from '@/stores/__tests__/workflowFixture'
import type { classifyCloudValidationError } from '@/utils/executionErrorUtil'

type CloudValidationResult = ReturnType<typeof classifyCloudValidationError>

const { handlers, errorStore, activeWorkflow, dist, classifyCloud } =
  vi.hoisted(() => ({
    handlers: {} as Record<string, (e: { detail: unknown }) => void>,
    errorStore: {
      clearExecutionStartErrors: () => {},
      clearPromptError: () => {}
    } as Record<string, unknown>,
    activeWorkflow: { value: null as { path: string } | null },
    dist: { isCloud: false },
    classifyCloud: vi.fn<(_: string) => CloudValidationResult>(() => null)
  }))

vi.mock('@/scripts/app', () => ({ app: { rootGraph: {} } }))
vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: (name: string, fn: (e: { detail: unknown }) => void) => {
      handlers[name] = fn
    },
    removeEventListener: () => {}
  }
}))
vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    isOpen: () => true,
    openWorkflows: [],
    nodeLocatorIdToNodeExecutionId: () => null,
    get activeWorkflow() {
      return activeWorkflow.value
    }
  })
}))
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ canvas: undefined })
}))
vi.mock('@/stores/executionErrorStore', () => ({
  useExecutionErrorStore: () => errorStore
}))
vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({ revokePreviewsByExecutionId: () => {} })
}))
vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({ mode: ref('default'), isAppMode: ref(false) })
}))
vi.mock('@/platform/telemetry', () => ({ useTelemetry: () => undefined }))
vi.mock('@/utils/appMode', () => ({
  getWorkflowMode: () => 'workflow',
  isAppModeValue: () => false
}))
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return dist.isCloud
  }
}))
vi.mock('@/platform/errorCatalog/accountPreconditionRouting', () => ({
  resolveAccountPrecondition: () => null
}))
vi.mock('@/utils/executionErrorUtil', () => ({
  classifyCloudValidationError: classifyCloud
}))

function setup() {
  const store = useExecutionStore()
  store.bindExecutionEvents()
  return store
}

function workflow(path: string): ComfyWorkflow {
  return createTestWorkflow({ path })
}

function promptOutput(): ComfyApiWorkflow {
  return {}
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const key of Object.keys(handlers)) delete handlers[key]
  activeWorkflow.value = null
  dist.isCloud = false
  classifyCloud.mockReturnValue(null)
  for (const k of ['lastPromptError', 'lastNodeErrors', 'lastExecutionError'])
    delete errorStore[k]
})

describe('executionStore running state and error edges', () => {
  it('lists jobs with a running node and counts running workflows', () => {
    const store = setup()
    handlers['progress_state']?.({
      detail: {
        prompt_id: 'job-1',
        nodes: { n1: { state: 'running', value: 1, max: 2 } }
      }
    })

    expect(store.runningJobIds).toEqual(['job-1'])
    expect(store.runningWorkflowCount).toBe(1)
  })

  it('does not report the active workflow as running when the path differs', () => {
    const store = setup()
    expect(store.isActiveWorkflowRunning).toBe(false)

    const wf = workflow('w.json')
    activeWorkflow.value = { path: 'other.json' }
    store.storeJob({
      nodes: [],
      id: 'job-2',
      promptOutput: promptOutput(),
      workflow: wf
    })
    handlers['execution_start']?.({ detail: { prompt_id: 'job-2' } })

    expect(store.isActiveWorkflowRunning).toBe(false)
  })

  it('reports the active workflow as running when job, path and session agree', () => {
    const store = setup()
    const wf = workflow('w.json')
    activeWorkflow.value = { path: 'w.json' }
    store.storeJob({
      nodes: [],
      id: 'job-2',
      promptOutput: promptOutput(),
      workflow: wf
    })
    handlers['execution_start']?.({ detail: { prompt_id: 'job-2' } })

    expect(store.isActiveWorkflowRunning).toBe(true)
  })

  it('formats a service-level error message from the exception message alone', () => {
    setup()
    handlers['execution_error']?.({
      detail: { prompt_id: 'job-3', exception_message: 'Job has stagnated' }
    })

    expect(errorStore.lastPromptError).toEqual({
      type: 'error',
      message: 'Job has stagnated',
      details: ''
    })
  })

  it('stores a classified cloud prompt error on the prompt-error branch', () => {
    dist.isCloud = true
    classifyCloud.mockReturnValue({
      kind: 'promptError',
      promptError: { type: 'validation', message: 'bad input', details: '' }
    })
    setup()

    handlers['execution_error']?.({
      detail: { prompt_id: 'job-4', exception_message: '{}' }
    })

    expect(errorStore.lastPromptError).toEqual({
      type: 'validation',
      message: 'bad input',
      details: ''
    })
  })
})
