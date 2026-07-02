import { beforeEach, describe, expect, it, vi } from 'vitest'

const { distribution, downloads } = vi.hoisted(() => ({
  distribution: { isDesktop: false },
  downloads: { values: [] as unknown[] }
}))

vi.mock('@/components/sidebar/tabs/ModelLibrarySidebarTab.vue', () => ({
  default: {}
}))

vi.mock('@/platform/distribution/types', () => ({
  get isDesktop() {
    return distribution.isDesktop
  }
}))

vi.mock('@/stores/electronDownloadStore', () => ({
  useElectronDownloadStore: () => ({
    inProgressDownloads: downloads.values
  })
}))

describe('useModelLibrarySidebarTab', () => {
  beforeEach(() => {
    distribution.isDesktop = false
    downloads.values = []
  })

  it('hides the badge outside desktop builds', async () => {
    distribution.isDesktop = false
    downloads.values = [{ id: 'download-1' }]
    const { useModelLibrarySidebarTab } =
      await import('./useModelLibrarySidebarTab')

    const sidebarTab = useModelLibrarySidebarTab()

    expect((sidebarTab.iconBadge as () => string | null)()).toBeNull()
  })

  it('shows active desktop download count', async () => {
    distribution.isDesktop = true
    downloads.values = [{ id: 'a' }, { id: 'b' }]
    const { useModelLibrarySidebarTab } =
      await import('./useModelLibrarySidebarTab')

    const sidebarTab = useModelLibrarySidebarTab()

    expect((sidebarTab.iconBadge as () => string | null)()).toBe('2')
  })

  it('hides the badge when desktop has no active downloads', async () => {
    distribution.isDesktop = true
    const { useModelLibrarySidebarTab } =
      await import('./useModelLibrarySidebarTab')

    const sidebarTab = useModelLibrarySidebarTab()

    expect((sidebarTab.iconBadge as () => string | null)()).toBeNull()
  })
})
