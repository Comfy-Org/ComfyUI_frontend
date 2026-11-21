import { nextTick, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { useFeatureFlags } from '@/composables/useFeatureFlags'
import * as distribution from '@/platform/distribution/types'
import { registerLocalMcpSurface } from '@/platform/localMcp/registerLocalMcpSurface'
import { useLocalMcpStore } from '@/platform/localMcp/useLocalMcpStore'
import { LOCAL_MCP_TAB_ID } from '@/platform/localMcp/useLocalMcpSidebarTab'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const flags = reactive({ localMcpConnectEnabled: false })

vi.mock(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () =>
    ({ flags }) as unknown as ReturnType<typeof useFeatureFlags>
}))
vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: false,
  isDesktop: false,
  isNightly: false,
  DISTRIBUTION: 'localhost' as const
}))
vi.mock<unknown>(
  import('@/platform/localMcp/components/LocalMcpSidebarTab.vue'),
  () => ({ default: {} })
)
vi.mock(import('@/i18n'), () => ({ t: (key: string) => key, te: () => false }))

const hasTab = () =>
  useSidebarTabStore().sidebarTabs.some((tab) => tab.id === LOCAL_MCP_TAB_ID)

describe('registerLocalMcpSurface', () => {
  let stop: (() => void) | undefined
  const register = () => {
    stop = registerLocalMcpSurface()
  }

  afterEach(() => stop?.())

  beforeEach(() => {
    flags.localMcpConnectEnabled = false
    vi.mocked(distribution).isCloud = false
  })

  it('registers nothing while the flag is off', () => {
    register()
    expect(hasTab()).toBe(false)
  })

  it('registers the tab, tracks exposure and starts watching when the flag turns on', async () => {
    const store = useLocalMcpStore()
    const trackExposed = vi.spyOn(store, 'trackExposed')
    const startWatching = vi.spyOn(store, 'startWatching')
    register()

    flags.localMcpConnectEnabled = true
    await nextTick()

    expect(hasTab()).toBe(true)
    expect(trackExposed).toHaveBeenCalledOnce()
    expect(startWatching).toHaveBeenCalledOnce()
  })

  it('removes the tab and stops watching when the flag turns off', async () => {
    const store = useLocalMcpStore()
    const stopWatching = vi.spyOn(store, 'stopWatching')
    flags.localMcpConnectEnabled = true
    register()
    expect(hasTab()).toBe(true)

    flags.localMcpConnectEnabled = false
    await nextTick()

    expect(hasTab()).toBe(false)
    expect(stopWatching).toHaveBeenCalledOnce()
  })

  it('never registers on Cloud, even with the flag on', () => {
    vi.mocked(distribution).isCloud = true
    flags.localMcpConnectEnabled = true

    register()

    expect(hasTab()).toBe(false)
  })
})
