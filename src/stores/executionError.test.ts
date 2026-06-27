import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useExecutionStore } from '@/stores/executionStore'

const {
  handlers,
  openSet,
  errorStore,
  dist,
  resolvePrecondition,
  classifyCloud
} = vi.hoisted(() => ({
  handlers: {} as Record<string, (e: { detail: unknown }) => void>,
  openSet: new Set<unknown>(),
  errorStore: {
    clearExecutionStartErrors: () => {},
    clearPromptError: () => {}
  } as Record<string, unknown>,
  dist: { isCloud: false },
  resolvePrecondition: vi.fn(),
  classifyCloud: vi.fn()
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
    isOpen: (workflow: unknown) => openSet.has(workflow),
    openWorkflows: [],
    nodeLocatorIdToNodeExecutionId: () => null
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ canvas: undefined })
}))

vi.mock('@/stores/executionErrorStore', () => ({
  useExecutionErrorStore: () => errorStore
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
  resolveAccountPrecondition: resolvePrecondition
}))

vi.mock('@/utils/executionErrorUtil', () => ({
  classifyCloudValidationError: classifyCloud
}))

function workflow(path: string): ComfyWorkflow {
  return { path } as unknown as ComfyWorkflow
}

function promptOutput(): ComfyApiWorkflow {
  return {}
}

function setup() {
  const store = useExecutionStore()
  store.bindExecutionEvents()
  return store
}

function fireError(detail: Record<string, unknown>) {
  handlers['execution_error']?.({ detail })
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const key of Object.keys(handlers)) delete handlers[key]
  openSet.clear()
  dist.isCloud = false
  resolvePrecondition.mockReturnValue(null)
  classifyCloud.mockReturnValue(null)
  for (const key of ['lastExecutionError', 'lastPromptError', 'lastNodeErrors'])
    delete errorStore[key]
})

describe('executionStore error handling', () => {
  it('marks an open workflow failed and records the raw execution error', () => {
    const store = setup()
    const wf = workflow('a.json')
    openSet.add(wf)
    store.storeJob({
      nodes: [],
      id: 'job-1',
      promptOutput: promptOutput(),
      workflow: wf
    })

    const detail = {
      prompt_id: 'job-1',
      node_id: '5',
      exception_message: 'boom'
    }
    fireError(detail)

    expect(store.getWorkflowStatus(wf)).toBe('failed')
    expect(errorStore.lastExecutionError).toBe(detail)
  })

  it('routes account-precondition errors away from the failed badge', () => {
    resolvePrecondition.mockReturnValue({ type: 'credits' })
    const store = setup()
    const wf = workflow('b.json')
    openSet.add(wf)
    store.storeJob({
      nodes: [],
      id: 'job-2',
      promptOutput: promptOutput(),
      workflow: wf
    })

    fireError({ prompt_id: 'job-2', exception_type: 'AccountError' })

    expect(store.getWorkflowStatus(wf)).toBeUndefined()
    expect(errorStore.lastExecutionError).toBeUndefined()
  })

  it('records a node-less service-level error as a prompt error', () => {
    setup()

    fireError({
      prompt_id: 'job-3',
      exception_type: 'StagnationError',
      exception_message: 'stuck',
      traceback: ['line1', 'line2']
    })

    expect(errorStore.lastPromptError).toEqual({
      type: 'StagnationError',
      message: 'StagnationError: stuck',
      details: 'line1\nline2'
    })
  })

  it('records classified cloud validation node errors without a failed badge', () => {
    dist.isCloud = true
    classifyCloud.mockReturnValue({
      kind: 'nodeErrors',
      nodeErrors: { '5': { errors: [] } }
    })
    const store = setup()
    const wf = workflow('c.json')
    openSet.add(wf)
    store.storeJob({
      nodes: [],
      id: 'job-4',
      promptOutput: promptOutput(),
      workflow: wf
    })

    fireError({ prompt_id: 'job-4', exception_message: '{"nodeErrors":{}}' })

    expect(store.getWorkflowStatus(wf)).toBeUndefined()
    expect(errorStore.lastNodeErrors).toEqual({ '5': { errors: [] } })
  })
})
