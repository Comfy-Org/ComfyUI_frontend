import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

import { registerWorkflowTabActivityTracker } from './workflowTabActivityTracker'

type FakeTab = { path: string }

const hostWorkflow = vi.hoisted(() => ({
  store: null as unknown as {
    activeWorkflow: FakeTab | null
    openWorkflows: FakeTab[]
  }
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', async () => {
  const { reactive } = await import('vue')
  const store = reactive({
    activeWorkflow: null as FakeTab | null,
    openWorkflows: [] as FakeTab[]
  })
  hostWorkflow.store = store
  return { useWorkflowStore: () => store }
})

describe('registerWorkflowTabActivityTracker', () => {
  let stop: () => void

  beforeEach(() => {
    setActivePinia(createPinia())
    hostWorkflow.store.activeWorkflow = null
    hostWorkflow.store.openWorkflows = []
    stop = registerWorkflowTabActivityTracker()
  })

  afterEach(() => {
    stop()
  })

  it('clears the unseen dot when its tab becomes active, with no panel mounted', async () => {
    const activity = useWorkflowTabActivityStore()
    activity.markModified('workflows/a.json')

    hostWorkflow.store.activeWorkflow = { path: 'workflows/a.json' }
    await nextTick()

    expect(activity.unseenModifiedPaths.has('workflows/a.json')).toBe(false)
  })

  it('prunes activity state when a tab closes, with no panel mounted', async () => {
    const activity = useWorkflowTabActivityStore()
    hostWorkflow.store.openWorkflows = [
      { path: 'workflows/a.json' },
      { path: 'workflows/b.json' }
    ]
    await nextTick()
    activity.setEditing('workflows/b.json')
    activity.markModified('workflows/b.json')

    hostWorkflow.store.openWorkflows = [{ path: 'workflows/a.json' }]
    await nextTick()

    expect(activity.editingTabPath).toBeNull()
    expect(activity.unseenModifiedPaths.has('workflows/b.json')).toBe(false)
  })

  it('stops watching once its scope is disposed', async () => {
    const activity = useWorkflowTabActivityStore()
    activity.markModified('workflows/a.json')

    stop()
    hostWorkflow.store.activeWorkflow = { path: 'workflows/a.json' }
    await nextTick()

    expect(activity.unseenModifiedPaths.has('workflows/a.json')).toBe(true)
  })
})
