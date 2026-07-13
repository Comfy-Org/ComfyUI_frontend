import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { toNodeId } from '@/types/nodeId'

import type { ScreenRect } from './canvasSpotlightAdapter'
import type { TourStep } from './tourSequence'

const mocks = vi.hoisted(() => ({
  maskRects: [] as ScreenRect[],
  controller: {
    end: vi.fn(),
    back: vi.fn(),
    advance: vi.fn()
  }
}))

vi.mock('./canvasSpotlightAdapter', () => ({
  maskRectsFor: () => mocks.maskRects
}))

vi.mock('./useOnboardingTourController', () => ({
  useOnboardingTourController: () => mocks.controller
}))

import OnboardingTourOverlay from './OnboardingTourOverlay.vue'
import { useOnboardingTourStore } from './onboardingTourStore'

import enMessages from '@/locales/en/main.json'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const promptStep: TourStep = {
  kind: 'prompt',
  nodeId: null,
  prompt: {
    subgraphNodeId: toNodeId(2),
    innerNodeId: toNodeId(3),
    widgetName: 'text',
    portFallback: 'prompt'
  }
}

const runStep: TourStep = { kind: 'run', nodeId: null }

const videoResultStep: TourStep = {
  kind: 'result',
  nodeId: toNodeId(4),
  mediaKind: 'video'
}

function rect(left: number): ScreenRect {
  return { left, top: 0, width: 100, height: 50 }
}

function renderOverlay() {
  return render(OnboardingTourOverlay, { global: { plugins: [i18n] } })
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
    store.steps = [promptStep, runStep]
    renderOverlay()
    expect(
      await screen.findByRole('dialog', { name: 'Getting started tour' })
    ).toBeInTheDocument()
  })

  it('spotlights one hole per revealed node when active', async () => {
    mocks.maskRects = [rect(0), rect(200)]
    store.phase = 'active'
    store.steps = [promptStep, runStep]
    store.revealedNodeIds = new Set([toNodeId(1), toNodeId(2)])

    renderOverlay()
    await vi.waitFor(() => {
      expect(screen.getAllByTestId('onboarding-spotlight')).toHaveLength(2)
    })
  })

  it('shows the step counter derived from stepIndex and the step total', async () => {
    store.phase = 'active'
    store.steps = [promptStep, runStep, videoResultStep]
    store.stepIndex = 1

    renderOverlay()

    expect(await screen.findByText('2 of 3')).toBeInTheDocument()
  })

  it('renders the copy for the active step', async () => {
    store.phase = 'active'
    store.steps = [promptStep, runStep]

    renderOverlay()

    expect(await screen.findByText('Tell it what to make')).toBeInTheDocument()
  })

  it('renders video result copy for a video sink', async () => {
    store.phase = 'active'
    store.steps = [runStep, videoResultStep]
    store.stepIndex = 1

    renderOverlay()

    expect(
      await screen.findByText('Your first video is ready.')
    ).toBeInTheDocument()
  })

  it('shows the port hint only when prompt focus fell back to the port', async () => {
    store.phase = 'active'
    store.steps = [promptStep, runStep]
    store.promptPortFallback = true

    renderOverlay()

    expect(
      await screen.findByText('Click the prompt input to start typing.')
    ).toBeInTheDocument()
  })

  it('ends the tour with skip when the Skip control is pressed', async () => {
    store.phase = 'active'
    store.steps = [promptStep, runStep]
    const user = userEvent.setup()

    renderOverlay()

    await user.click(await screen.findByRole('button', { name: 'Skip' }))
    expect(mocks.controller.end).toHaveBeenCalledWith('skip')
  })

  it('advances on Next before the last step', async () => {
    store.phase = 'active'
    store.steps = [promptStep, runStep, videoResultStep]
    store.stepIndex = 0
    const user = userEvent.setup()

    renderOverlay()

    await user.click(await screen.findByRole('button', { name: 'Next' }))
    expect(mocks.controller.advance).toHaveBeenCalledOnce()
  })

  it('shows Done and finishes the tour on the last step', async () => {
    store.phase = 'active'
    store.steps = [runStep, videoResultStep]
    store.stepIndex = 1
    const user = userEvent.setup()

    renderOverlay()

    await user.click(await screen.findByRole('button', { name: 'Done' }))
    expect(mocks.controller.end).toHaveBeenCalledWith('done')
  })

  it('hides Back on the first step', async () => {
    store.phase = 'active'
    store.steps = [promptStep, runStep, videoResultStep]
    store.stepIndex = 0

    renderOverlay()

    await screen.findByRole('button', { name: 'Next' })
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  })

  it('shows Back after the first step and goes back on press', async () => {
    store.phase = 'active'
    store.steps = [promptStep, runStep, videoResultStep]
    store.stepIndex = 1
    const user = userEvent.setup()

    renderOverlay()

    await user.click(await screen.findByRole('button', { name: 'Back' }))
    expect(mocks.controller.back).toHaveBeenCalledOnce()
  })
})
