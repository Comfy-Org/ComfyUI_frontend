import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useErrorResolutionStore } from '@/stores/workspace/errorResolutionStore'

const activeWorkflow = ref<{ key: string; activeMode?: string } | null>(null)

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get activeWorkflow() {
      return activeWorkflow.value
    }
  })
}))

describe('errorResolutionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    activeWorkflow.value = { key: 'workflow-a' }
  })

  it('is inactive by default and toggles via enter/exit', () => {
    const store = useErrorResolutionStore()
    expect(store.isActive).toBe(false)

    store.enter()
    expect(store.isActive).toBe(true)

    store.exit()
    expect(store.isActive).toBe(false)
  })

  it('exits automatically when the active workflow changes', async () => {
    const store = useErrorResolutionStore()
    store.enter()

    activeWorkflow.value = { key: 'workflow-b' }
    await nextTick()

    expect(store.isActive).toBe(false)
  })

  it('exits automatically when the active workflow is closed', async () => {
    const store = useErrorResolutionStore()
    store.enter()

    activeWorkflow.value = null
    await nextTick()

    expect(store.isActive).toBe(false)
  })

  it('stays active while the workflow key is unchanged', async () => {
    const store = useErrorResolutionStore()
    store.enter()

    activeWorkflow.value = { key: 'workflow-a' }
    await nextTick()

    expect(store.isActive).toBe(true)
  })

  it('exits when the workflow switches back to app mode', async () => {
    activeWorkflow.value = { key: 'workflow-a', activeMode: 'graph' }
    const store = useErrorResolutionStore()
    store.enter()

    activeWorkflow.value = { key: 'workflow-a', activeMode: 'app' }
    await nextTick()

    expect(store.isActive).toBe(false)
  })
})
