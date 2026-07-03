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

function setup() {
  const store = useExecutionStore()
  store.bindExecutionEvents()
  return store
}

function promptOutput(): ComfyApiWorkflow {
  return {}
}

function startJob(
  store: ReturnType<typeof useExecutionStore>,
  id: string,
  wf: ComfyWorkflow,
  nodes: string[] = []
) {
  openSet.add(wf)
  store.storeJob({ nodes, id, promptOutput: promptOutput(), workflow: wf })
  handlers['execution_start']?.({ detail: { prompt_id: id } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const key of Object.keys(handlers)) delete handlers[key]
  openSet.clear()
})

describe('executionStore interrupt and cached', () => {
  it('drops the workflow badge and goes idle on interruption', () => {
    const store = setup()
    const wf = workflow('a.json')
    startJob(store, 'job-1', wf)
    expect(store.getWorkflowStatus(wf)).toBe('running')

    handlers['execution_interrupted']?.({ detail: { prompt_id: 'job-1' } })

    expect(store.getWorkflowStatus(wf)).toBeUndefined()
    expect(store.isIdle).toBe(true)
  })

  it('ends the active job when executing resolves to null', () => {
    const store = setup()
    startJob(store, 'job-2', workflow('b.json'))
    expect(store.isIdle).toBe(false)

    handlers['executing']?.({ detail: null })

    expect(store.isIdle).toBe(true)
  })

  it('marks cached nodes as executed', () => {
    const store = setup()
    startJob(store, 'job-3', workflow('c.json'), ['a', 'b', 'c'])
    expect(store.nodesExecuted).toBe(0)

    handlers['execution_cached']?.({
      detail: { prompt_id: 'job-3', nodes: ['a', 'b'] }
    })

    expect(store.nodesExecuted).toBe(2)
  })
})
