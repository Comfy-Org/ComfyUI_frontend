import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { useAgentPanelStore } from './agentPanelStore'

const OPEN_STORAGE_KEY = 'Comfy.AgentPanel.open'

describe('agentPanelStore open-state persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  afterEach(() => {
    useAgentPanelStore().$dispose()
  })

  it('persists the open state when the panel is toggled open', async () => {
    const store = useAgentPanelStore()

    store.toggle()
    await nextTick()

    expect(store.isOpen).toBe(true)
    expect(localStorage.getItem(OPEN_STORAGE_KEY)).toBe('true')
  })

  it('rehydrates isOpen from a pre-seeded stored value', () => {
    localStorage.setItem(OPEN_STORAGE_KEY, 'true')

    const store = useAgentPanelStore()

    expect(store.isOpen).toBe(true)
  })

  it('persists the closed state when the panel is closed', async () => {
    localStorage.setItem(OPEN_STORAGE_KEY, 'true')
    const store = useAgentPanelStore()

    store.close()
    await nextTick()

    expect(store.isOpen).toBe(false)
    expect(localStorage.getItem(OPEN_STORAGE_KEY)).toBe('false')
  })

  it('keeps the stored open preference when the flag turns off mid-session', async () => {
    const store = useAgentPanelStore()
    store.enabled = true
    store.toggle()
    await nextTick()

    // Disabling must never wipe the open preference for the next enabled session.
    store.enabled = false
    await nextTick()

    expect(store.isOpen).toBe(true)
    expect(localStorage.getItem(OPEN_STORAGE_KEY)).toBe('true')
  })

  it('starts unsettled and does not plant a storage key for flag-off users', () => {
    const store = useAgentPanelStore()

    expect(store.gateSettled).toBe(false)
    expect(localStorage.getItem(OPEN_STORAGE_KEY)).toBeNull()
  })
})
