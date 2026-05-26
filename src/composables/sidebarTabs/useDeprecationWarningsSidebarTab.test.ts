import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  DEPRECATION_WARNINGS_TAB_ID,
  useDeprecationWarningsSidebarTab
} from '@/composables/sidebarTabs/useDeprecationWarningsSidebarTab'
import { useDeprecationWarningsStore } from '@/platform/dev/deprecationWarningsStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

function iconBadgeOf(tab = useDeprecationWarningsSidebarTab()): string | null {
  if (typeof tab.iconBadge !== 'function') {
    throw new Error('expected iconBadge to be a function')
  }
  return tab.iconBadge()
}

describe('useDeprecationWarningsSidebarTab', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    // Drain warnings buffered during module-load imports.
    useDeprecationWarningsStore().clear()
  })

  it('iconBadge returns null when there are no unseen warnings', () => {
    expect(iconBadgeOf()).toBeNull()
  })

  it('iconBadge returns the unseen count when warnings are present', () => {
    const store = useDeprecationWarningsStore()
    store.report({ message: 'one' })
    store.report({ message: 'two' })
    expect(iconBadgeOf()).toBe('2')
  })

  it('iconBadge clamps the count at "9+"', () => {
    const store = useDeprecationWarningsStore()
    for (let i = 0; i < 12; i++) store.report({ message: `m${i}` })
    expect(iconBadgeOf()).toBe('9+')
  })

  it('iconBadge returns null while the tab itself is active', () => {
    const store = useDeprecationWarningsStore()
    store.report({ message: 'one' })

    useSidebarTabStore().activeSidebarTabId = DEPRECATION_WARNINGS_TAB_ID

    expect(iconBadgeOf()).toBeNull()
  })

  it('iconBadge returns null after markAllSeen', () => {
    const store = useDeprecationWarningsStore()
    store.report({ message: 'one' })
    store.markAllSeen()
    expect(iconBadgeOf()).toBeNull()
  })
})
