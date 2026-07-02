import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { NodeProgressState } from '@/schemas/apiSchema'
import { useExecutionStore } from '@/stores/executionStore'

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

// Derive from the real schema type so the test shape can't drift; keep the
// non-essential fields optional so cases only spell out what they assert on.
type NodeState = Partial<NodeProgressState> & Pick<NodeProgressState, 'state'>

function progressState(jobId: string, nodes: Record<string, NodeState>) {
  handlers['progress_state']?.({ detail: { prompt_id: jobId, nodes } })
}

function setup() {
  const store = useExecutionStore()
  store.bindExecutionEvents()
  return store
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const key of Object.keys(handlers)) delete handlers[key]
})

describe('executionStore node progress', () => {
  it('is idle until an execution starts', () => {
    const store = setup()
    expect(store.isIdle).toBe(true)

    handlers['execution_start']?.({ detail: { prompt_id: 'job-1' } })
    expect(store.isIdle).toBe(false)
  })

  it('derives the running node ids from a progress_state event', () => {
    const store = setup()

    progressState('job-1', {
      n1: { state: 'running', value: 1, max: 4 },
      n2: { state: 'finished' },
      n3: { state: 'pending' }
    })

    expect(store.executingNodeIds).toEqual(['n1'])
    expect(store.executingNodeId).toBe('n1')
  })

  it('exposes fractional progress for the executing node', () => {
    const store = setup()

    progressState('job-1', {
      n1: { state: 'running', value: 1, max: 4 }
    })

    expect(store.executingNodeProgress).toBe(0.25)
  })

  it('reports no executing node when none are running', () => {
    const store = setup()

    progressState('job-1', {
      n1: { state: 'finished' },
      n2: { state: 'pending' }
    })

    expect(store.executingNodeIds).toEqual([])
    expect(store.executingNodeId).toBeNull()
  })

  it('replaces progress state on each progress_state event', () => {
    const store = setup()

    progressState('job-1', { n1: { state: 'running', value: 1, max: 4 } })
    expect(store.executingNodeId).toBe('n1')

    progressState('job-1', { n2: { state: 'running', value: 2, max: 2 } })
    expect(store.executingNodeIds).toEqual(['n2'])
  })
})
