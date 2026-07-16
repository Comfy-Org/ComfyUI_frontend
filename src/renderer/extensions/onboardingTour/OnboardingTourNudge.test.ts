import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

const mocks = vi.hoisted(() => ({
  show: vi.fn(),
  trackExploreTemplatesClicked: vi.fn(),
  trackNudgeShown: vi.fn()
}))

// A reactive backing so the component's modal-close watch actually fires, the
// same way the real store's `isDialogOpen` reads a reactive dialog stack.
const openDialogs = ref<string[]>([])

vi.mock('@/composables/useWorkflowTemplateSelectorDialog', () => ({
  useWorkflowTemplateSelectorDialog: () => ({ show: mocks.show })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackOnboardingTourExploreTemplatesClicked:
      mocks.trackExploreTemplatesClicked,
    trackOnboardingTourNudgeShown: mocks.trackNudgeShown
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    isDialogOpen: (key: string) => openDialogs.value.includes(key)
  })
}))

vi.mock('@/scripts/app', () => ({ app: { canvas: null } }))

import OnboardingTourNudge from './OnboardingTourNudge.vue'
import { useOnboardingTourStore } from './onboardingTourStore'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderNudge() {
  // No appear delay: these assert what the nudge shows, not when it fades in.
  return render(OnboardingTourNudge, {
    props: { appearDelayMs: 0 },
    global: { plugins: [i18n] }
  })
}

const nudgeTitle = enMessages.onboardingTour.nudge.title

describe('OnboardingTourNudge', () => {
  let store: ReturnType<typeof useOnboardingTourStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useOnboardingTourStore()
    mocks.show.mockReset()
    mocks.trackExploreTemplatesClicked.mockReset()
    mocks.trackNudgeShown.mockReset()
    openDialogs.value = []
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing until the nudge is requested', () => {
    renderNudge()

    expect(screen.queryByText(nudgeTitle)).not.toBeInTheDocument()
  })

  it('shows the post-run prompt once the store requests it', async () => {
    renderNudge()
    store.showNudge()

    expect(await screen.findByText(nudgeTitle)).toBeInTheDocument()
  })

  describe('appear delay', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('holds the nudge back so the fresh result gets a beat on its own', async () => {
      vi.useFakeTimers()
      render(OnboardingTourNudge, {
        props: { appearDelayMs: 2000 },
        global: { plugins: [i18n] }
      })

      store.showNudge()
      await vi.advanceTimersByTimeAsync(1999)
      expect(screen.queryByText(nudgeTitle)).not.toBeInTheDocument()

      await vi.advanceTimersByTimeAsync(1)
      expect(screen.getByText(nudgeTitle)).toBeInTheDocument()
    })

    it('never appears when the nudge is withdrawn inside the delay', async () => {
      // Dismissing during the wait must cancel the pending appearance, not fire late.
      vi.useFakeTimers()
      render(OnboardingTourNudge, {
        props: { appearDelayMs: 2000 },
        global: { plugins: [i18n] }
      })

      store.showNudge()
      await vi.advanceTimersByTimeAsync(1000)
      store.dismissNudge()
      await vi.advanceTimersByTimeAsync(5000)

      expect(screen.queryByText(nudgeTitle)).not.toBeInTheDocument()
    })

    it('reports the nudge as shown only when it actually appears', async () => {
      vi.useFakeTimers()
      render(OnboardingTourNudge, {
        props: { appearDelayMs: 2000 },
        global: { plugins: [i18n] }
      })

      store.showNudge()
      await vi.advanceTimersByTimeAsync(1000)
      expect(mocks.trackNudgeShown).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1000)
      expect(mocks.trackNudgeShown).toHaveBeenCalledOnce()
    })
  })

  it('leads with the generated image when the result media is an image', async () => {
    renderNudge()
    store.resultMedia = { url: 'result.png', kind: 'image' }
    store.showNudge()

    const image = await screen.findByRole('img', { name: nudgeTitle })
    expect(image).toHaveAttribute('src', 'result.png')
  })

  it('leads with a looping video when the result media is a video', async () => {
    renderNudge()
    store.resultMedia = { url: 'result.mp4', kind: 'video' }
    store.showNudge()

    const video = await screen.findByTestId('onboarding-nudge-video')
    expect(video).toHaveAttribute('src', 'result.mp4')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('opens the template library and reports the click on Explore templates', async () => {
    renderNudge()
    store.showNudge()
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole('button', {
        name: enMessages.onboardingTour.nudge.explore
      })
    )

    expect(mocks.show).toHaveBeenCalledOnce()
    expect(mocks.trackExploreTemplatesClicked).toHaveBeenCalledOnce()
  })

  it('permanently dismisses on Not now and does not resurface', async () => {
    renderNudge()
    store.showNudge()
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole('button', {
        name: enMessages.onboardingTour.nudge.dismiss
      })
    )

    expect(screen.queryByText(nudgeTitle)).not.toBeInTheDocument()

    // A later trigger must not bring it back this session.
    store.showNudge()
    expect(screen.queryByText(nudgeTitle)).not.toBeInTheDocument()
  })

  it('defers past the open upgrade modal and surfaces once it closes', async () => {
    openDialogs.value = ['free-tier-info']
    // showNudge while the modal is open must defer, not overlap the paywall.
    store.showNudge()
    renderNudge()

    expect(screen.queryByText(nudgeTitle)).not.toBeInTheDocument()

    openDialogs.value = []

    expect(await screen.findByText(nudgeTitle)).toBeInTheDocument()
  })

  it('stays hidden on modal close when the nudge was never requested', async () => {
    openDialogs.value = ['subscription-required']
    renderNudge()

    openDialogs.value = []
    await nextTick()

    expect(screen.queryByText(nudgeTitle)).not.toBeInTheDocument()
  })

  it('surfaces the deferred nudge only once across repeated modal cycles', async () => {
    openDialogs.value = ['free-tier-info']
    store.showNudge()
    renderNudge()
    const user = userEvent.setup()

    openDialogs.value = []
    await user.click(
      await screen.findByRole('button', {
        name: enMessages.onboardingTour.nudge.dismiss
      })
    )
    expect(screen.queryByText(nudgeTitle)).not.toBeInTheDocument()

    // A second upgrade-modal cycle must not resurface the dismissed nudge:
    // the arm was consumed on the first surfacing and dismissal is permanent.
    openDialogs.value = ['free-tier-info']
    await nextTick()
    openDialogs.value = []
    await nextTick()

    expect(screen.queryByText(nudgeTitle)).not.toBeInTheDocument()
  })
})
