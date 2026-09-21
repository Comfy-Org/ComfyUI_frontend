import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useOnboardingOverlayStore } from '@/platform/onboarding/onboardingOverlayStore'

describe('useOnboardingOverlayStore', () => {
  it('is inactive with no registered sources', () => {
    const store = useOnboardingOverlayStore()
    expect(store.active).toBe(false)
  })

  it('reports a registered source reactively', () => {
    const store = useOnboardingOverlayStore()
    const running = ref(false)
    store.registerSource(() => running.value)

    expect(store.active).toBe(false)
    running.value = true
    expect(store.active).toBe(true)
    running.value = false
    expect(store.active).toBe(false)
  })

  it('is active while any one source is active', () => {
    const store = useOnboardingOverlayStore()
    const a = ref(false)
    const b = ref(false)
    store.registerSource(() => a.value)
    store.registerSource(() => b.value)

    expect(store.active).toBe(false)
    b.value = true
    expect(store.active).toBe(true)
  })

  it('drops a source when it deregisters, so an overlay cannot leak', () => {
    const store = useOnboardingOverlayStore()
    const running = ref(true)
    const stop = store.registerSource(() => running.value)

    expect(store.active).toBe(true)
    stop()
    expect(store.active).toBe(false)
  })
})
