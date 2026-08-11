import { cleanup, render } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref, withDirectives } from 'vue'

import { coachmarkElements } from './coachmarkRegistry'
import type { CoachId } from './onboardingTours'
import { vCoachmark } from './vCoachmark'

// Mounts a host element carrying `v-coachmark`, so the directive runs through
// Vue's real mount/update/unmount lifecycle rather than hand-called hooks.
function mountHost(initial: CoachId | null) {
  const coachId = ref<CoachId | null>(initial)
  const rev = ref(0)
  const Host = defineComponent({
    setup: () => () =>
      withDirectives(
        h('div', { 'data-testid': 'host', 'data-rev': rev.value }),
        [[vCoachmark, coachId.value]]
      )
  })
  return {
    ...render(Host),
    coachId,
    // Forces a re-render without touching the bound id, to exercise the
    // no-op-update guard.
    rerender: () => {
      rev.value++
      return nextTick()
    }
  }
}

describe('vCoachmark', () => {
  afterEach(cleanup)

  it('registers the element and mirrors the id to data-coach-id on mount', () => {
    const { getByTestId } = mountHost('app-run-button')
    const host = getByTestId('host')
    expect(host.dataset.coachId).toBe('app-run-button')
    expect(coachmarkElements('app-run-button')).toContain(host)
  })

  it('does not register an element bound to a falsy id', () => {
    const { getByTestId } = mountHost(null)
    expect(getByTestId('host').dataset.coachId).toBeUndefined()
    expect(coachmarkElements('app-run-button')).toHaveLength(0)
  })

  it('moves the element to the new id when the binding changes', async () => {
    const { getByTestId, coachId } = mountHost('app-run-button')
    const host = getByTestId('host')
    coachId.value = 'outputs'
    await nextTick()
    expect(host.dataset.coachId).toBe('outputs')
    expect(coachmarkElements('app-run-button')).not.toContain(host)
    expect(coachmarkElements('outputs')).toContain(host)
  })

  it('ignores a re-render that leaves the id unchanged', async () => {
    const { getByTestId, rerender } = mountHost('app-run-button')
    const host = getByTestId('host')
    await rerender()
    expect(coachmarkElements('app-run-button')).toEqual([host])
  })

  it('unregisters and clears data-coach-id on unmount', () => {
    const { getByTestId, unmount } = mountHost('app-run-button')
    const host = getByTestId('host')
    unmount()
    expect(host.dataset.coachId).toBeUndefined()
    expect(coachmarkElements('app-run-button')).not.toContain(host)
  })
})
