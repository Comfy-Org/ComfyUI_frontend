import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

const gate = {
  isCloud: true,
  isSubscriptionEnabled: true,
  isNewUser: true as boolean | null,
  onboardingTourEnabled: true,
  isDesktop: true
}

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return gate.isCloud
  }
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    isSubscriptionEnabled: () => gate.isSubscriptionEnabled
  })
}))

vi.mock('@/services/useNewUserService', () => ({
  useNewUserService: () => ({ isNewUser: () => gate.isNewUser })
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get onboardingTourEnabled() {
        return gate.onboardingTourEnabled
      }
    }
  })
}))

vi.mock('@/composables/useDesktopLayout', () => ({
  useDesktopLayout: () => ({
    get value() {
      return gate.isDesktop
    }
  })
}))

const setups = { 'getting-started': vi.fn(), overlay: vi.fn(), nudge: vi.fn() }
function stub(id: keyof typeof setups) {
  return defineComponent({
    setup() {
      setups[id]()
      return () => h('div', { 'data-testid': id })
    }
  })
}
vi.mock('./GettingStartedScreen.vue', () => ({
  default: stub('getting-started')
}))
vi.mock('./FirstRunTourOverlay.vue', () => ({ default: stub('overlay') }))
vi.mock('./FirstRunTourNudge.vue', () => ({ default: stub('nudge') }))

import FirstRunTourGate from './FirstRunTourGate.vue'

const ids = ['getting-started', 'overlay', 'nudge'] as const

const DISQUALIFIERS: { when: string; disqualify: () => void }[] = [
  { when: 'off the Cloud build', disqualify: () => (gate.isCloud = false) },
  {
    when: 'when subscriptions are disabled',
    disqualify: () => (gate.isSubscriptionEnabled = false)
  },
  { when: 'for a returning user', disqualify: () => (gate.isNewUser = false) },
  {
    when: 'before the new-user verdict is known',
    disqualify: () => (gate.isNewUser = null)
  },
  {
    when: 'when the flag is off',
    disqualify: () => (gate.onboardingTourEnabled = false)
  },
  {
    when: 'below the desktop viewport',
    disqualify: () => (gate.isDesktop = false)
  }
]

describe('FirstRunTourGate', () => {
  beforeEach(() => {
    gate.isCloud = true
    gate.isSubscriptionEnabled = true
    gate.isNewUser = true
    gate.onboardingTourEnabled = true
    gate.isDesktop = true
    ids.forEach((id) => setups[id].mockClear())
  })

  it('mounts and runs the bundled components when every gate flag holds', () => {
    render(FirstRunTourGate)
    ids.forEach((id) => {
      expect(screen.getByTestId(id)).toBeInTheDocument()
      expect(setups[id]).toHaveBeenCalledOnce()
    })
  })

  it.for(DISQUALIFIERS)(
    'never instantiates the bundled bodies for ineligible users $when',
    ({ disqualify }) => {
      disqualify()
      render(FirstRunTourGate)
      ids.forEach((id) => {
        expect(screen.queryByTestId(id)).toBeNull()
        expect(setups[id]).not.toHaveBeenCalled()
      })
    }
  )
})
