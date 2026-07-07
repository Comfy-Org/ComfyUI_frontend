import { beforeEach, describe, expect, it, vi } from 'vitest'

const { settings } = vi.hoisted(() => ({
  settings: { newDesign: false }
}))

const legacyComponent = { name: 'NodeLibrarySidebarTab' }
const newDesignComponent = { name: 'NodeLibrarySidebarTabV2' }

vi.mock('@/components/sidebar/tabs/NodeLibrarySidebarTab.vue', () => ({
  default: legacyComponent
}))

vi.mock('@/components/sidebar/tabs/NodeLibrarySidebarTabV2.vue', () => ({
  default: newDesignComponent
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) =>
      key === 'Comfy.NodeLibrary.NewDesign' && settings.newDesign
  })
}))

describe('useNodeLibrarySidebarTab', () => {
  beforeEach(() => {
    settings.newDesign = false
  })

  it('uses the legacy node library component by default', async () => {
    const { useNodeLibrarySidebarTab } =
      await import('./useNodeLibrarySidebarTab')

    const tab = useNodeLibrarySidebarTab()
    if (tab.type !== 'vue') throw new Error('Expected a vue sidebar tab')
    expect(tab.component).toBe(legacyComponent)
  })

  it('uses the new node library component when the setting is enabled', async () => {
    settings.newDesign = true
    const { useNodeLibrarySidebarTab } =
      await import('./useNodeLibrarySidebarTab')

    const tab = useNodeLibrarySidebarTab()
    if (tab.type !== 'vue') throw new Error('Expected a vue sidebar tab')
    expect(tab.component).toBe(newDesignComponent)
  })
})
