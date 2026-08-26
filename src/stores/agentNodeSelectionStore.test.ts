import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const dialogStack = vi.hoisted(() => [] as unknown[])

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ dialogStack })
}))

describe('agentNodeSelectionStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    dialogStack.length = 0
    setActivePinia(createPinia())
  })

  it('sequences selection chrome and restores the open sidebar', async () => {
    const sidebar = useSidebarTabStore()
    sidebar.activeSidebarTabId = 'assets'
    const store = useAgentNodeSelectionStore()

    store.enter()
    await nextTick()

    expect(store.isActive).toBe(true)
    expect(store.isActionBarsHidden).toBe(true)
    expect(store.isBannerVisible).toBe(false)
    expect(sidebar.activeSidebarTabId).toBe('assets')

    vi.advanceTimersByTime(200)
    expect(sidebar.activeSidebarTabId).toBeNull()

    vi.advanceTimersByTime(100)
    expect(store.isBannerVisible).toBe(true)

    store.exit()
    await nextTick()

    expect(store.isActive).toBe(false)
    expect(store.isBannerVisible).toBe(false)
    expect(store.isActionBarsHidden).toBe(true)
    expect(sidebar.activeSidebarTabId).toBe('assets')

    vi.advanceTimersByTime(150)
    expect(store.isActionBarsHidden).toBe(false)
  })

  it('exits on Escape unless a dialog is open', async () => {
    const store = useAgentNodeSelectionStore()
    store.enter()
    await nextTick()

    dialogStack.push({})
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(store.isActive).toBe(true)

    dialogStack.length = 0
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(store.isActive).toBe(false)
  })

  it('keeps node selections scoped to their workflow while loading', () => {
    const store = useAgentNodeSelectionStore()

    store.saveNodeIds('workflows/first.json', ['9', '12'])
    store.beginWorkflowLoad()
    store.saveNodeIds('workflows/second.json', ['20'])

    expect(store.isLoadingWorkflow).toBe(true)
    expect(store.nodeIds('workflows/first.json')).toEqual(['9', '12'])
    expect(store.nodeIds('workflows/second.json')).toEqual(['20'])

    store.restoreNodeIds(['20'])
    expect(store.restoredNodeIds).toEqual(['20'])

    store.finishWorkflowLoad()

    expect(store.isLoadingWorkflow).toBe(false)
    expect(store.restoredNodeIds).toBeNull()
  })
})
