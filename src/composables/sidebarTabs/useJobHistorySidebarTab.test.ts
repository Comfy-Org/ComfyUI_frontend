import { describe, expect, it, vi } from 'vitest'
import { useQueueStore } from '@/stores/queueStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

import { useJobHistorySidebarTab } from '@/composables/sidebarTabs/useJobHistorySidebarTab'

vi.mock<unknown>(
  import('@/components/sidebar/tabs/JobHistorySidebarTab.vue'),
  () => ({
    default: {}
  })
)

describe('useJobHistorySidebarTab', () => {
  it('shows active jobs count while the panel is closed', () => {
    useSidebarTabStore().activeSidebarTabId = 'assets'
    Object.assign(useQueueStore(), { activeJobsCount: 3 })

    const sidebarTab = useJobHistorySidebarTab()

    expect(typeof sidebarTab.iconBadge).toBe('function')
    expect((sidebarTab.iconBadge as () => string | null)()).toBe('3')
  })

  it('hides badge while the job history panel is open', () => {
    useSidebarTabStore().activeSidebarTabId = 'job-history'
    Object.assign(useQueueStore(), { activeJobsCount: 3 })

    const sidebarTab = useJobHistorySidebarTab()

    expect((sidebarTab.iconBadge as () => string | null)()).toBeNull()
  })

  it('hides badge when there are no active jobs', () => {
    useSidebarTabStore().activeSidebarTabId = null

    const sidebarTab = useJobHistorySidebarTab()

    expect((sidebarTab.iconBadge as () => string | null)()).toBeNull()
  })
})
