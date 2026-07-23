import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useExecutionStore } from '@/stores/executionStore'
import { createTestWorkflow } from '@/stores/__tests__/workflowFixture'

const { handlers } = vi.hoisted(() => ({
  handlers: {} as Record<string, (e: { detail: unknown }) => void>
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
    isOpen: () => false,
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
  nodes: string[]
) {
  store.storeJob({
    nodes,
    id,
    promptOutput: promptOutput(),
    workflow: createTestWorkflow({ path: `${id}.json` })
  })
  handlers['execution_start']?.({ detail: { prompt_id: id } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const key of Object.keys(handlers)) delete handlers[key]
})

describe('executionStore execution lifecycle', () => {
  it('counts the queued nodes once a job starts', () => {
    const store = setup()
    startJob(store, 'job-1', ['a', 'b', 'c'])

    expect(store.totalNodesToExecute).toBe(3)
    expect(store.nodesExecuted).toBe(0)
    expect(store.executionProgress).toBe(0)
  })

  it('advances progress as executed events arrive', () => {
    const store = setup()
    startJob(store, 'job-1', ['a', 'b', 'c'])

    handlers['executed']?.({ detail: { node: 'a' } })
    expect(store.nodesExecuted).toBe(1)
    expect(store.executionProgress).toBeCloseTo(1 / 3)

    handlers['executed']?.({ detail: { node: 'b' } })
    handlers['executed']?.({ detail: { node: 'c' } })
    expect(store.nodesExecuted).toBe(3)
    expect(store.executionProgress).toBe(1)
  })

  it('ignores executed events when there is no active job', () => {
    const store = setup()
    handlers['executed']?.({ detail: { node: 'a' } })
    expect(store.nodesExecuted).toBe(0)
  })
})
