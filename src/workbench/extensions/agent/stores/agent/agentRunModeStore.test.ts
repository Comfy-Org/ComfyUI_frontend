import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { useAgentRunModeStore } from './agentRunModeStore'

describe('agentRunModeStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('T-01 / PM-647 / FE-1313 defaults to asking before every run with a 300 credit limit', () => {
    const store = useAgentRunModeStore()
    expect(store.mode).toBe('ask')
    expect(store.creditLimit).toBe(300)
  })

  it('persists a saved mode and limit across store instances', async () => {
    useAgentRunModeStore().save('auto-limit', 500)
    await nextTick()

    setActivePinia(createPinia())
    const reloaded = useAgentRunModeStore()
    expect(reloaded.mode).toBe('auto-limit')
    expect(reloaded.creditLimit).toBe(500)
  })

  it('keeps the previous limit when the new one is not a positive number', () => {
    const store = useAgentRunModeStore()
    store.save('auto', 0)
    expect(store.mode).toBe('auto')
    expect(store.creditLimit).toBe(300)
    store.save('auto-limit', Number.NaN)
    expect(store.creditLimit).toBe(300)
    store.save('auto-limit', 0.5)
    expect(store.creditLimit).toBe(300)
    store.save('auto-limit', 2.9)
    expect(store.creditLimit).toBe(2)
  })
})
