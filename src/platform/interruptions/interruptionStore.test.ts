import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

import { useTelemetry } from '@/platform/telemetry'

import { useInterruptionStore } from './interruptionStore'

vi.mock(import('@/platform/telemetry'), () => ({
  useTelemetry: vi.fn(() => null)
}))

function register(
  id: string,
  isActive: () => boolean,
  tier: 'blocking' | 'announcement' | 'research' = 'blocking',
  order = 0
) {
  return useInterruptionStore().registerSource({ id, tier, order, isActive })
}

describe('useInterruptionStore', () => {
  beforeEach(() => {
    vi.mocked(useTelemetry).mockReturnValue(null)
  })

  it('shows when nothing is registered', () => {
    expect(useInterruptionStore().decideFor('whatsNewPopup')).toEqual({
      kind: 'show'
    })
  })

  it('defers to an active higher-tier source, naming it, and releases', () => {
    const store = useInterruptionStore()
    const active = ref(true)
    register('dialog', () => active.value)

    expect(store.decideFor('whatsNewPopup')).toEqual({
      kind: 'defer',
      reason: 'outranked',
      by: 'dialog'
    })
    active.value = false
    expect(store.decideFor('whatsNewPopup')).toEqual({ kind: 'show' })
  })

  it('ignores an inactive source and a lower-tier one', () => {
    const store = useInterruptionStore()
    register('idle', () => false)
    register('survey', () => true, 'research')

    expect(store.decideFor('whatsNewPopup')).toEqual({ kind: 'show' })
  })

  it('does not read the getter of a source that cannot outrank the surface', () => {
    const store = useInterruptionStore()
    const lowerTier = vi.fn(() => true)
    register('survey', lowerTier, 'research')

    store.decideFor('whatsNewPopup')

    expect(lowerTier).not.toHaveBeenCalled()
  })

  it('drops a source with its owning scope', () => {
    const store = useInterruptionStore()
    const scope = effectScope()
    scope.run(() => register('scoped', () => true))
    expect(store.decideFor('whatsNewPopup')).toMatchObject({ by: 'scoped' })

    scope.stop()
    expect(store.decideFor('whatsNewPopup')).toEqual({ kind: 'show' })
  })

  it('stops only the registration it was returned for', () => {
    const store = useInterruptionStore()
    const stopFirst = register('same', () => true)
    register('same', () => true)

    stopFirst()
    expect(store.decideFor('whatsNewPopup')).toMatchObject({ by: 'same' })
  })

  describe('record', () => {
    it('keeps the log bounded to the newest entries', () => {
      const store = useInterruptionStore()
      for (let i = 0; i < 250; i++)
        store.record({
          surface: i === 249 ? 'releaseToast' : 'whatsNewPopup',
          tier: 'announcement',
          outcome: 'shown'
        })

      expect(store.exposures).toHaveLength(200)
      expect(store.exposures.at(-1)?.surface).toBe('releaseToast')
    })

    it('reports the exposure to telemetry with the blocker', () => {
      const trackInterruptionExposure = vi.fn()
      vi.mocked(useTelemetry).mockReturnValue({
        trackInterruptionExposure
      } as unknown as ReturnType<typeof useTelemetry>)

      useInterruptionStore().record({
        surface: 'whatsNewPopup',
        tier: 'announcement',
        outcome: 'deferred',
        by: 'dialog'
      })

      expect(trackInterruptionExposure).toHaveBeenCalledExactlyOnceWith({
        surface: 'whatsNewPopup',
        tier: 'announcement',
        outcome: 'deferred',
        blocked_by: 'dialog'
      })
    })

    it('omits blocked_by when nothing blocked', () => {
      const trackInterruptionExposure = vi.fn()
      vi.mocked(useTelemetry).mockReturnValue({
        trackInterruptionExposure
      } as unknown as ReturnType<typeof useTelemetry>)

      useInterruptionStore().record({
        surface: 'releaseToast',
        tier: 'announcement',
        outcome: 'shown'
      })

      expect(trackInterruptionExposure).toHaveBeenCalledExactlyOnceWith({
        surface: 'releaseToast',
        tier: 'announcement',
        outcome: 'shown'
      })
    })

    it('still logs when telemetry is absent', () => {
      const store = useInterruptionStore()
      store.record({
        surface: 'releaseToast',
        tier: 'announcement',
        outcome: 'shown'
      })

      expect(store.exposures).toHaveLength(1)
    })
  })
})
