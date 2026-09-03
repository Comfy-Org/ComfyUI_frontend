import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

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
    stop = registerWorkflowTabActivityTracker(ref(true))
  })

  afterEach(() => {
    stop()
  })

  it('T-13 / PM-671 / FE-1306 clears tab activity when its workflow becomes active with no panel mounted', async () => {
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

  it('stops tab watchers created after the feature is enabled', async () => {
    stop()
    const enabled = ref(false)
    stop = registerWorkflowTabActivityTracker(enabled)
    const activity = useWorkflowTabActivityStore()

    enabled.value = true
    await nextTick()
    stop()
    activity.markModified('workflows/a.json')
    hostWorkflow.store.activeWorkflow = { path: 'workflows/a.json' }
    await nextTick()

    expect(activity.unseenModifiedPaths.has('workflows/a.json')).toBe(true)
  })

  it('does not register tab watchers while the feature is disabled', async () => {
    stop()
    const enabled = ref(false)
    stop = registerWorkflowTabActivityTracker(enabled)
    const activity = useWorkflowTabActivityStore()
    activity.markModified('workflows/a.json')

    hostWorkflow.store.activeWorkflow = { path: 'workflows/a.json' }
    await nextTick()

    expect(activity.unseenModifiedPaths.has('workflows/a.json')).toBe(true)
  })

  it('registers on enable and removes agent activity on disable', async () => {
    stop()
    const enabled = ref(false)
    stop = registerWorkflowTabActivityTracker(enabled)
    const activity = useWorkflowTabActivityStore()

    enabled.value = true
    await nextTick()
    activity.markModified('workflows/a.json')
    hostWorkflow.store.activeWorkflow = { path: 'workflows/a.json' }
    await nextTick()
    expect(activity.unseenModifiedPaths.has('workflows/a.json')).toBe(false)

    activity.markModified('workflows/b.json')
    activity.setEditing('workflows/b.json')
    enabled.value = false
    await nextTick()

    expect(activity.unseenModifiedPaths).toHaveLength(0)
    expect(activity.editingTabPath).toBeNull()
  })
})
