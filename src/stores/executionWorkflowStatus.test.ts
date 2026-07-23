import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useExecutionStore } from '@/stores/executionStore'
import { createTestWorkflow } from '@/stores/__tests__/workflowFixture'

const { handlers, openSet } = vi.hoisted(() => ({
  handlers: {} as Record<string, (e: { detail: unknown }) => void>,
  openSet: new Set<unknown>()
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
  useExecutionErrorStore: () => ({
    clearExecutionStartErrors: () => {},
    clearPromptError: () => {}
  })
}))

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({ mode: ref('default'), isAppMode: ref(false) })
}))

vi.mock('@/platform/telemetry', () => ({ useTelemetry: () => undefined }))

vi.mock('@/utils/appMode', () => ({
  getWorkflowMode: () => 'workflow',
  isAppModeValue: () => false
}))

function workflow(path: string): ComfyWorkflow {
  return createTestWorkflow({ path })
}

function promptOutput(): ComfyApiWorkflow {
  return {}
}

function storeJob(
  store: ReturnType<typeof useExecutionStore>,
  id: string,
  wf: ComfyWorkflow
) {
  store.storeJob({ nodes: [], id, promptOutput: promptOutput(), workflow: wf })
}

function fire(event: string, jobId: string) {
  handlers[event]?.({ detail: { prompt_id: jobId } })
}

function setup() {
  const store = useExecutionStore()
  store.bindExecutionEvents()
  return store
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const key of Object.keys(handlers)) delete handlers[key]
  openSet.clear()
})

describe('executionStore workflow status', () => {
  it('marks an open workflow running on execution_start and completed on success', () => {
    const store = setup()
    const wf = workflow('a.json')
    openSet.add(wf)
    storeJob(store, 'job-1', wf)

    fire('execution_start', 'job-1')
    expect(store.getWorkflowStatus(wf)).toBe('running')

    fire('execution_success', 'job-1')
    expect(store.getWorkflowStatus(wf)).toBe('completed')
  })

  it('buffers a status that arrives before the job is attached, then flushes on storeJob', () => {
    const store = setup()
    const wf = workflow('b.json')
    openSet.add(wf)

    fire('execution_start', 'job-2')
    expect(store.getWorkflowStatus(wf)).toBeUndefined()

    storeJob(store, 'job-2', wf)
    expect(store.getWorkflowStatus(wf)).toBe('running')
  })

  it('does not apply status to a workflow that is not open', () => {
    const store = setup()
    const wf = workflow('c.json')
    storeJob(store, 'job-3', wf)

    fire('execution_start', 'job-3')
    expect(store.getWorkflowStatus(wf)).toBeUndefined()
  })

  it('clears a workflow status', () => {
    const store = setup()
    const wf = workflow('d.json')
    openSet.add(wf)
    storeJob(store, 'job-4', wf)
    fire('execution_start', 'job-4')
    expect(store.getWorkflowStatus(wf)).toBe('running')

    store.clearWorkflowStatus(wf)
    expect(store.getWorkflowStatus(wf)).toBeUndefined()
  })

  it('does not let a late buffered running overwrite a terminal status', () => {
    const store = setup()
    const wf = workflow('e.json')
    openSet.add(wf)

    storeJob(store, 'job-5', wf)
    fire('execution_success', 'job-5')
    expect(store.getWorkflowStatus(wf)).toBe('completed')

    fire('execution_start', 'job-6')
    storeJob(store, 'job-6', wf)
    expect(store.getWorkflowStatus(wf)).toBe('completed')
  })

  it('returns undefined for a null or unknown workflow', () => {
    const store = setup()
    expect(store.getWorkflowStatus(null)).toBeUndefined()
    expect(store.getWorkflowStatus(workflow('unknown.json'))).toBeUndefined()
  })
})
