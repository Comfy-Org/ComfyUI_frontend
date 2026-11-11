import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useAgentPanelStore } from './agentPanelStore'

vi.mock(import('@comfyorg/telemetry'))

const STORAGE_KEY = 'Comfy.AgentPanel.sidebarWidth'

function resizeWindowTo(px: number): void {
  window.innerWidth = px
  window.dispatchEvent(new Event('resize'))
}

describe('agentPanelStore sidebar width', () => {
  beforeEach(() => {
    localStorage.clear()
    resizeWindowTo(1920)
  })

  it('starts at the default width without writing to storage', async () => {
    const store = useAgentPanelStore()
    await nextTick()

    expect(store.sidebarWidth).toBe(260)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('saves a new width to storage', async () => {
    const store = useAgentPanelStore()

    store.setSidebarWidth(340)
    await nextTick()

    expect(store.sidebarWidth).toBe(340)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('340')
  })

  it('stores a whole number of pixels', () => {
    const store = useAgentPanelStore()

    store.setSidebarWidth(301.6)

    expect(store.sidebarWidth).toBe(302)
  })

  it('restores the saved width', () => {
    localStorage.setItem(STORAGE_KEY, '340')

    expect(useAgentPanelStore().sidebarWidth).toBe(340)
  })

  it('narrows with the window and widens back to the chosen width', () => {
    const store = useAgentPanelStore()
    store.setSidebarWidth(470)

    resizeWindowTo(920)
    expect(store.sidebarWidth).toBe(440)

    resizeWindowTo(1920)
    expect(store.sidebarWidth).toBe(470)
  })

  it('does not remember a width the window had no room for', () => {
    const store = useAgentPanelStore()
    resizeWindowTo(920)

    store.setSidebarWidth(470)
    resizeWindowTo(1920)

    expect(store.sidebarWidth).toBe(440)
  })

  it('returns to the default width on reset', () => {
    const store = useAgentPanelStore()
    store.setSidebarWidth(340)

    store.resetSidebarWidth()

    expect(store.sidebarWidth).toBe(260)
  })

  it('falls back to the default width when storage holds garbage', () => {
    localStorage.setItem(STORAGE_KEY, 'wide')

    expect(useAgentPanelStore().sidebarWidth).toBe(260)
  })
})
