import { describe, expect, it, vi } from 'vitest'

const mockActiveDownloadCount = { value: 0 }

vi.mock('../stores/modelDownloadStore', () => ({
  useModelDownloadStore: () => ({
    get activeDownloadCount() {
      return mockActiveDownloadCount.value
    }
  })
}))

vi.mock('../components/ModelManagerSidebarTab.vue', () => ({
  default: { name: 'ModelManagerSidebarTab' }
}))

import { useModelManagerSidebarTab } from './useModelManagerSidebarTab'

describe('useModelManagerSidebarTab', () => {
  it('returns the expected sidebar tab extension shape', () => {
    const tab = useModelManagerSidebarTab()

    expect(tab.id).toBe('model-manager')
    expect(tab.type).toBe('vue')
    expect(tab.title).toBe('modelManager.title')
    expect(tab.tooltip).toBe('modelManager.title')
    expect(tab.label).toBe('modelManager.title')
  })

  it('shows no badge when there are no active downloads', () => {
    mockActiveDownloadCount.value = 0
    const tab = useModelManagerSidebarTab()

    expect(typeof tab.iconBadge).toBe('function')
    expect((tab.iconBadge as () => string | null)()).toBeNull()
  })

  it('shows the active download count as a badge', () => {
    mockActiveDownloadCount.value = 3
    const tab = useModelManagerSidebarTab()

    expect((tab.iconBadge as () => string | null)()).toBe('3')
  })
})
