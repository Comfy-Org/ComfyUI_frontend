import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { setupAutoQueueHandler } from '@/services/autoQueueService'
import { app } from '@/scripts/app'
import {
  useQueuePendingTaskCountStore,
  useQueueSettingsStore
} from '@/stores/queueStore'

const { mockAddEventListener, mockApp, mockWorkspaceWorkflow } = vi.hoisted(
  () => ({
    mockAddEventListener: vi.fn(),
    mockApp: {
      queuePrompt: vi.fn(),
      lastExecutionError: null
    },
    mockWorkspaceWorkflow: {
      activeWorkflow: null as LoadedComfyWorkflow | null
    }
  })
)

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: mockAddEventListener
  }
}))

vi.mock('@/scripts/app', () => ({
  app: mockApp
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: vi.fn(() => ({
    workflow: mockWorkspaceWorkflow
  }))
}))

describe('setupAutoQueueHandler', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    mockWorkspaceWorkflow.activeWorkflow = null
    mockApp.lastExecutionError = null
  })

  it('keeps Run Instant bound to the workflow where it started', async () => {
    const workflowA = { path: 'workflows/a.json' } as LoadedComfyWorkflow
    const workflowB = { path: 'workflows/b.json' } as LoadedComfyWorkflow
    const queueSettingsStore = useQueueSettingsStore()
    const queueCountStore = useQueuePendingTaskCountStore()

    mockWorkspaceWorkflow.activeWorkflow = workflowA
    queueSettingsStore.batchCount = 3
    setupAutoQueueHandler()

    queueSettingsStore.$patch({ mode: 'instant-running' })
    await nextTick()
    mockWorkspaceWorkflow.activeWorkflow = workflowB

    queueCountStore.$patch({ count: 1 })
    await nextTick()
    queueCountStore.$patch({ count: 0 })
    await nextTick()

    expect(app.queuePrompt).toHaveBeenCalledWith(0, 3, undefined, workflowA)
  })

  it('clears the Run Instant workflow when instant mode stops', async () => {
    const workflowA = { path: 'workflows/a.json' } as LoadedComfyWorkflow
    const workflowB = { path: 'workflows/b.json' } as LoadedComfyWorkflow
    const queueSettingsStore = useQueueSettingsStore()
    const queueCountStore = useQueuePendingTaskCountStore()

    mockWorkspaceWorkflow.activeWorkflow = workflowA
    queueSettingsStore.batchCount = 2
    setupAutoQueueHandler()

    queueSettingsStore.$patch({ mode: 'instant-running' })
    await nextTick()
    queueSettingsStore.$patch({ mode: 'instant-idle' })
    await nextTick()
    mockWorkspaceWorkflow.activeWorkflow = workflowB
    queueSettingsStore.$patch({ mode: 'instant-running' })
    await nextTick()

    queueCountStore.$patch({ count: 1 })
    await nextTick()
    queueCountStore.$patch({ count: 0 })
    await nextTick()

    expect(app.queuePrompt).toHaveBeenCalledWith(0, 2, undefined, workflowB)
  })
})
