import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { toNodeId } from '@/types/nodeId'

import type * as adapterModule from './canvasSpotlightAdapter'
import type { ScreenRect } from './canvasSpotlightAdapter'
import type { TourStep } from './tourSequence'

type AdapterModule = typeof adapterModule

const mocks = vi.hoisted(() => ({
  maskRects: [] as ScreenRect[],
  // Optional per-node-id rects: when set, `maskRectsFor` returns one rect per id
  // that has an entry, so the revealed (holes) and spotlit (rings) calls resolve
  // by which ids they carry — not by how many. Falls back to `maskRects`.
  rectsById: null as Record<string, ScreenRect> | null,
  focusNodes: vi.fn(),
  // A camera already at rest: these assert what a step renders, not the settle
  // machine (covered against the real `trackSettle` in the adapter's own tests).
  transformKey: 'settled' as string | null,
  viewport: { left: 0, top: 0, width: 1440, height: 900 } as ScreenRect,
  controller: {
    end: vi.fn(),
    back: vi.fn(),
    advance: vi.fn()
  }
}))

// Only the litegraph-backed reads are stubbed; the pure geometry helpers stay real,
// so a test that pans a target off screen exercises the same code prod does.
vi.mock('./canvasSpotlightAdapter', async (importOriginal) => ({
  ...(await importOriginal<AdapterModule>()),
  // Zero so a step's copy is gated only on the camera settling, never on a wait.
  TOUR_FOCUS_DURATION_MS: 0,
  // Return a fresh array (like prod) so a caller pushing to it can't grow the mock.
  maskRectsFor: (ids: unknown[]) =>
    mocks.rectsById === null
      ? [...mocks.maskRects]
      : (ids as { toString(): string }[])
          .map((id) => mocks.rectsById?.[String(id)])
          .filter((r): r is ScreenRect => r !== undefined),
  focusNodes: mocks.focusNodes,
  canvasViewport: () => mocks.viewport,
  canvasTransformKey: () => mocks.transformKey,
  canvasElement: () => null
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
    mocks.transformKey = 'settled'
    mocks.viewport = { left: 0, top: 0, width: 1440, height: 900 }
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

  it('shows Complete and finishes the tour on the last step', async () => {
    store.phase = 'active'
    store.steps = [runStep, videoResultStep]
    store.stepIndex = 1
    const user = userEvent.setup()

    renderOverlay()

    await user.click(await screen.findByRole('button', { name: 'Complete' }))
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
    expect(screen.queryByRole('button', { name: 'Complete' })).toBeNull()
    // Skip and Back remain so the user is never trapped.
    expect(screen.getByRole('button', { name: 'Skip' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Back' })).toBeVisible()
  })

  it('lights the action bar on the Result step without ringing it', async () => {
    // The run lives in the toolbar, so the Result step keeps it out of the scrim —
    // but unringed, so the eye stays on the sink node the coach-mark points at.
    const actionbar = document.createElement('div')
    actionbar.setAttribute('data-testid', 'comfy-actionbar')
    actionbar.getBoundingClientRect = () =>
      ({ left: 5, top: 5, width: 80, height: 8 }) as DOMRect
    document.body.append(actionbar)
    mocks.maskRects = [rect(0)] // the sink node

    store.phase = 'active'
    store.steps = [runStep, imageResultStep]
    store.stepIndex = 1

    try {
      renderOverlay()

      // Two holes cut (sink node + action bar)...
      await vi.waitFor(() => {
        expect(screen.getAllByTestId('onboarding-hole')).toHaveLength(2)
      })
      // ...but only the sink node is ringed.
      expect(screen.getAllByTestId('onboarding-spotlight')).toHaveLength(1)
    } finally {
      actionbar.remove()
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

  it('keeps the result copy and shows a generating indicator while the run is live', async () => {
    store.phase = 'active'
    store.steps = [runStep, imageResultStep]
    store.stepIndex = 1
    store.resultMedia = null
    store.runFinished = false

    renderOverlay()

    expect(
      await screen.findByText(
        'Your new image lands right here — ready to download or share.'
      )
    ).toBeInTheDocument()
    expect(await screen.findByText('Generating…')).toBeInTheDocument()
  })

  it('stops generating once the run reports, even if no media was captured', async () => {
    // The capture polls the sink and gives up silently on timeout. Hanging the
    // spinner off the media left it running forever when no URL ever landed.
    store.phase = 'active'
    store.steps = [runStep, imageResultStep]
    store.stepIndex = 1
    store.resultMedia = null
    store.runFinished = true

    renderOverlay()

    await screen.findByText(
      'Your new image lands right here — ready to download or share.'
    )
    expect(screen.queryByText('Generating…')).toBeNull()
  })

  it('stops generating once the media lands', async () => {
    store.phase = 'active'
    store.steps = [runStep, imageResultStep]
    store.stepIndex = 1
    store.resultMedia = { url: 'blob:result', kind: 'image' }
    store.runFinished = true

    renderOverlay()

    await screen.findByText(
      'Your new image lands right here — ready to download or share.'
    )
    expect(screen.queryByText('Generating…')).toBeNull()
  })

  it('hides Skip and Back on the Result step so Complete is the only exit', async () => {
    store.phase = 'active'
    store.steps = [promptStep, runStep, imageResultStep]
    store.stepIndex = 2

    renderOverlay()

    expect(
      await screen.findByRole('button', { name: 'Complete' })
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  })

  it('hides the ring and holds the coach-mark when the target is panned off screen', async () => {
    // The user can pan the spotlit node out of view mid-step. The ring must not be
    // drawn off screen, and the mark must hold rather than chase a target that
    // isn't there.
    mocks.maskRects = [rect(0)]
    store.phase = 'active'
    store.steps = [promptStep, runStep]
    store.stepIndex = 0

    renderOverlay()
    await vi.waitFor(() => {
      expect(screen.getAllByTestId('onboarding-spotlight')).toHaveLength(1)
    })

    mocks.maskRects = [{ left: -900, top: -900, width: 100, height: 50 }]

    await vi.waitFor(() => {
      expect(screen.queryByTestId('onboarding-spotlight')).toBeNull()
    })
    expect(screen.queryByTestId('onboarding-cursor')).toBeNull()
  })

  it('keeps the coach-mark on screen when the target fills the viewport', async () => {
    // A zoomed-in node can be larger than the canvas region; the mark must still be
    // fully placed inside it rather than spilling off an edge.
    mocks.viewport = { left: 0, top: 40, width: 800, height: 600 }
    mocks.maskRects = [{ left: 0, top: 40, width: 800, height: 600 }]
    store.phase = 'active'
    store.steps = [promptStep, runStep]
    store.stepIndex = 0

    renderOverlay()

    const mark = await screen.findByTestId('onboarding-coach-mark')
    await vi.waitFor(() => {
      expect(screen.getAllByTestId('onboarding-spotlight')).toHaveLength(1)
    })
    const top = Number.parseFloat(mark.style.top)
    const left = Number.parseFloat(mark.style.left)

    expect(top).toBeGreaterThanOrEqual(mocks.viewport.top)
    expect(left).toBeGreaterThanOrEqual(mocks.viewport.left)
  })

  it('zooms in once, then pans without re-zooming on later steps', async () => {
    // Reserving room on the first framing sizes the node so the mark fits beside
    // it; later steps pass none, which pans at the scale already reached.
    mocks.maskRects = [rect(0)]
    store.phase = 'active'
    store.steps = [promptStep, runStep, imageResultStep]
    store.stepIndex = 0

    renderOverlay()

    await vi.waitFor(() => expect(mocks.focusNodes).toHaveBeenCalled())
    expect(mocks.focusNodes.mock.calls[0][1]).toEqual(
      expect.objectContaining({ width: expect.any(Number) })
    )

    mocks.focusNodes.mockClear()
    store.stepIndex = 2

    await vi.waitFor(() => expect(mocks.focusNodes).toHaveBeenCalled())
    expect(mocks.focusNodes.mock.calls[0][1]).toBeUndefined()
  })

  it('does not move the camera on the Run step, which points at the toolbar', async () => {
    store.phase = 'active'
    store.steps = [promptStep, runStep]
    store.stepIndex = 0

    renderOverlay()
    await vi.waitFor(() => expect(mocks.focusNodes).toHaveBeenCalled())

    mocks.focusNodes.mockClear()
    store.stepIndex = 1
    await screen.findByText('Press Run to start generating your result')

    expect(mocks.focusNodes).not.toHaveBeenCalled()
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
