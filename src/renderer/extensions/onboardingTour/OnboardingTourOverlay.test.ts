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
  // Optional per-node-id rects: when set, `maskRectsFor` returns one rect per id
  // that has an entry, so the revealed (holes) and spotlit (rings) calls resolve
  // by which ids they carry — not by how many. Falls back to `maskRects`.
  rectsById: null as Record<string, ScreenRect> | null,
  focusNodes: vi.fn(),
  controller: {
    end: vi.fn(),
    back: vi.fn(),
    advance: vi.fn()
  }
}))

vi.mock('./canvasSpotlightAdapter', () => ({
  RUN_BUTTON_SELECTOR:
    '[data-testid="queue-button"], [data-testid="subscribe-to-run-button"]',
  TOUR_FOCUS_DURATION_MS: 0,
  // Return a fresh array (like prod) so a caller pushing to it can't grow the mock.
  maskRectsFor: (ids: unknown[]) =>
    mocks.rectsById === null
      ? [...mocks.maskRects]
      : (ids as { toString(): string }[])
          .map((id) => mocks.rectsById?.[String(id)])
          .filter((r): r is ScreenRect => r !== undefined),
  focusNodes: mocks.focusNodes,
  coachMarkPosition: () => ({ left: 0, top: 0, pointerEdge: 'top' })
}))

vi.mock('./useOnboardingTourController', () => ({
  useOnboardingTourController: () => mocks.controller
}))

vi.mock('@/scripts/app', () => ({ app: { canvas: null } }))

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

const imageResultStep: TourStep = {
  kind: 'result',
  nodeId: toNodeId(4),
  mediaKind: 'image'
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
    mocks.rectsById = null
    mocks.focusNodes.mockClear()
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

  it('draws a focus ring for each spotlit node when active', async () => {
    mocks.maskRects = [rect(0), rect(200)]
    store.phase = 'active'
    store.steps = [promptStep, runStep]
    store.stepIndex = 0

    renderOverlay()
    await vi.waitFor(() => {
      expect(screen.getAllByTestId('onboarding-spotlight')).toHaveLength(2)
    })
  })

  it('rings only the current step, not every revealed node', async () => {
    // At the prompt step both the upload node (1) and the prompt host (2) are
    // revealed, but only the prompt host is spotlit. Keying rects by id proves
    // the ring set is the current step's targets, not the accumulated reveals.
    const uploadStep: TourStep = { kind: 'upload', nodeId: toNodeId(1) }
    mocks.rectsById = { '1': rect(0), '2': rect(200) }
    store.phase = 'active'
    store.steps = [uploadStep, promptStep, runStep]
    store.stepIndex = 1

    renderOverlay()

    await vi.waitFor(() => {
      // Holes cover both revealed nodes (1 & 2); rings cover only spotlit node 2.
      expect(screen.getAllByTestId('onboarding-spotlight')).toHaveLength(1)
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

  it('renders video result copy for a video sink once the media is captured', async () => {
    store.phase = 'active'
    store.steps = [runStep, videoResultStep]
    store.stepIndex = 1
    store.resultMedia = { url: 'blob:video-output', kind: 'video' }

    renderOverlay()

    expect(
      await screen.findByText(
        'Your new video lands right here — ready to download or share.'
      )
    ).toBeInTheDocument()
  })

  it('keeps result media out of the coach-mark (it lands on the canvas node)', async () => {
    store.phase = 'active'
    store.steps = [runStep, imageResultStep]
    store.stepIndex = 1
    store.resultMedia = { url: 'blob:image-output', kind: 'image' }

    renderOverlay()

    await screen.findByText(
      'Your new image lands right here — ready to download or share.'
    )
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByTestId('onboarding-result-video')).toBeNull()
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

  it('points the decorative agent cursor at the focused target', async () => {
    mocks.maskRects = [rect(0)]
    store.phase = 'active'
    store.steps = [promptStep, runStep]

    renderOverlay()

    const cursor = await screen.findByTestId('onboarding-cursor')
    expect(cursor).toHaveAttribute('aria-hidden', 'true')
  })

  it('hides the cursor but keeps the coach-mark and Skip reachable with no target', async () => {
    mocks.maskRects = []
    store.phase = 'active'
    store.steps = [promptStep, runStep]

    renderOverlay()

    expect(await screen.findByRole('button', { name: 'Skip' })).toBeVisible()
    expect(screen.queryByTestId('onboarding-cursor')).toBeNull()
  })

  it('offers no Next escape on the Run step (the run is the only way forward)', async () => {
    store.phase = 'active'
    store.steps = [promptStep, runStep, imageResultStep]
    store.stepIndex = 1

    renderOverlay()

    await screen.findByText('Press Run to start generating your result')
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull()
    // Skip and Back remain so the user is never trapped.
    expect(screen.getByRole('button', { name: 'Skip' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Back' })).toBeVisible()
  })

  it('also spotlights the run progress bar on the Result step while generating', async () => {
    // The inline progress bar renders below the Run toolbar during generation;
    // the Result step lights it too so progress shows where it happens.
    const progress = document.createElement('div')
    progress.setAttribute('data-testid', 'queue-progress-overlay')
    progress.getBoundingClientRect = () =>
      ({ left: 5, top: 5, width: 80, height: 8 }) as DOMRect
    document.body.append(progress)
    mocks.maskRects = [rect(0)] // the sink node

    store.phase = 'active'
    store.steps = [runStep, imageResultStep]
    store.stepIndex = 1

    try {
      renderOverlay()

      // Sink node ring + the progress-bar ring = two spotlights.
      await vi.waitFor(() => {
        expect(screen.getAllByTestId('onboarding-spotlight')).toHaveLength(2)
      })
    } finally {
      progress.remove()
    }
  })

  it('spotlights only the sink on the Result step when no run bar is present', async () => {
    mocks.maskRects = [rect(0)]
    store.phase = 'active'
    store.steps = [runStep, imageResultStep]
    store.stepIndex = 1

    renderOverlay()

    await vi.waitFor(() => {
      expect(screen.getAllByTestId('onboarding-spotlight')).toHaveLength(1)
    })
  })

  it('keeps the result copy and shows a generating indicator until media lands', async () => {
    store.phase = 'active'
    store.steps = [runStep, imageResultStep]
    store.stepIndex = 1
    store.resultMedia = null

    renderOverlay()

    expect(
      await screen.findByText(
        'Your new image lands right here — ready to download or share.'
      )
    ).toBeInTheDocument()
    expect(await screen.findByText('Generating…')).toBeInTheDocument()
  })

  it('spotlights the toolbar Run button on the Run step', async () => {
    const runButton = document.createElement('div')
    runButton.setAttribute('data-testid', 'queue-button')
    runButton.getBoundingClientRect = () =>
      ({ left: 10, top: 20, width: 40, height: 16 }) as DOMRect
    document.body.append(runButton)

    store.phase = 'active'
    store.steps = [runStep]

    try {
      renderOverlay()

      await vi.waitFor(() => {
        expect(screen.getAllByTestId('onboarding-spotlight')).toHaveLength(1)
      })
    } finally {
      runButton.remove()
    }
  })
})
