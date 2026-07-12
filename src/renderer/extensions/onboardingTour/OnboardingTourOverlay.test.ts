import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { toNodeId } from '@/types/nodeId'

import type { ScreenRect } from './canvasSpotlightAdapter'

const mocks = vi.hoisted(() => ({
  maskRects: [] as ScreenRect[]
}))

vi.mock('./canvasSpotlightAdapter', () => ({
  maskRectsFor: () => mocks.maskRects
}))

import OnboardingTourOverlay from './OnboardingTourOverlay.vue'
import { useOnboardingTourStore } from './onboardingTourStore'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      onboardingTour: {
        overlayLabel: 'Getting started tour',
        skip: 'Skip',
        stepCounter: '{current} of {total}'
      }
    }
  }
})

function rect(left: number): ScreenRect {
  return { left, top: 0, width: 100, height: 50 }
}

function renderOverlay(totalSteps = 4) {
  return render(OnboardingTourOverlay, {
    props: { totalSteps },
    global: { plugins: [i18n] }
  })
}

describe('OnboardingTourOverlay', () => {
  let store: ReturnType<typeof useOnboardingTourStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useOnboardingTourStore()
    mocks.maskRects = []
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing while the tour is idle', () => {
    renderOverlay()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('names the dialog for assistive technology when active', async () => {
    store.phase = 'active'
    renderOverlay()
    expect(
      await screen.findByRole('dialog', { name: 'Getting started tour' })
    ).toBeInTheDocument()
  })

  it('spotlights one hole per revealed node when active', async () => {
    mocks.maskRects = [rect(0), rect(200)]
    store.phase = 'active'
    store.revealedNodeIds = new Set([toNodeId(1), toNodeId(2)])

    renderOverlay()
    await vi.waitFor(() => {
      expect(screen.getAllByTestId('onboarding-spotlight')).toHaveLength(2)
    })
  })

  it('shows the step counter derived from stepIndex and totalSteps', async () => {
    store.phase = 'active'
    store.stepIndex = 1

    renderOverlay(4)

    expect(await screen.findByText('2 of 4')).toBeInTheDocument()
  })

  it('exposes a focusable Skip control', async () => {
    store.phase = 'active'

    renderOverlay()

    const skip = await screen.findByRole('button', { name: 'Skip' })
    expect(skip).toBeInTheDocument()
    skip.focus()
    expect(skip).toHaveFocus()
  })

  it('emits skip when the Skip control is pressed', async () => {
    store.phase = 'active'
    const user = userEvent.setup()

    const { emitted } = renderOverlay()

    await user.click(await screen.findByRole('button', { name: 'Skip' }))
    expect(emitted()).toHaveProperty('skip')
  })
})
