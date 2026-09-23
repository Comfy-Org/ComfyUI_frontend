import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { i18n } from '@/i18n'
import { useOnboardingOverlayStore } from '@/platform/onboarding/onboardingOverlayStore'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import type { CoachStep } from '../../composables/agent/useOnboarding'
import { resetOnboardingNotShownReports } from '../../composables/agent/useOnboarding'

import OnboardingCoach from './OnboardingCoach.vue'

vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const KEY = 'coach-test'
const STEPS: CoachStep[] = [
  {
    target: '#panel',
    title: 'Meet the agent',
    body: 'Build and run workflows.',
    placement: 'left-center'
  },
  {
    target: '#composer',
    title: 'Choose a workflow',
    body: 'Choose what to edit.',
    placement: 'left-end'
  },
  {
    target: '#graph',
    title: 'Keep editing',
    body: 'Work alongside the agent.',
    placement: 'graph-bottom',
    toolbarTarget: '#toolbar'
  },
  {
    target: '#history',
    title: 'Previous chats',
    body: 'Continue an earlier chat.',
    placement: 'left-start'
  }
]
const rectangles: Record<string, DOMRect> = {
  panel: new DOMRect(950, 60, 420, 700),
  composer: new DOMRect(966, 600, 388, 144),
  graph: new DOMRect(60, 60, 880, 700),
  toolbar: new DOMRect(650, 700, 260, 40),
  history: new DOMRect(970, 104, 24, 24)
}

function mount(steps = STEPS) {
  return render(
    {
      components: { OnboardingCoach },
      setup: () => ({ steps, storageKey: KEY }),
      template:
        '<button>Outside tour</button><div id="panel" /><div id="composer" /><div id="graph"><div id="toolbar" /></div><div id="history" /><OnboardingCoach :steps="steps" :storage-key="storageKey" />'
    },
    { global: { plugins: [i18n] } }
  )
}

beforeEach(() => {
  localStorage.clear()
  resetOnboardingNotShownReports()
  vi.mocked(useTelemetry()!.trackAgentOnboardingNotShown).mockClear()
  vi.mocked(reportError).mockClear()
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      return (
        rectangles[this.id] ??
        new DOMRect(
          0,
          0,
          this.getAttribute('role') === 'dialog' ? 307 : 0,
          this.getAttribute('role') === 'dialog' ? 184 : 0
        )
      )
    }
  )
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(
    function (this: HTMLElement) {
      return this.getBoundingClientRect().width
    }
  )
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      return this.getBoundingClientRect().height
    }
  )
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1400)
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(800)
  window.innerWidth = 1400
  window.innerHeight = 800
})

describe('OnboardingCoach', () => {
  it('presents all four cards in order, keeps Skip available and finishes with Done', async () => {
    const user = userEvent.setup()
    const { unmount } = mount()
    for (const [index, step] of STEPS.entries()) {
      const dialog = await screen.findByRole('dialog', { name: step.title })
      expect(dialog).toHaveAccessibleDescription(step.body)
      await waitFor(() =>
        expect(screen.getByText(`${index + 1} of 4`)).toBeVisible()
      )
      expect(screen.getByRole('button', { name: 'Skip' })).toBeVisible()
      expect(localStorage.getItem(KEY)).toBe('false')
      await user.click(
        screen.getByRole('button', { name: index === 3 ? 'Done' : 'Next' })
      )
    }
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(localStorage.getItem(KEY)).toBe('true')
    unmount()
    mount()
    await nextTick()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.for([0, 1, 2, 3])(
    'dismisses through Skip from card index %i',
    async (index) => {
      const user = userEvent.setup()
      mount()
      await screen.findByRole('dialog', { name: STEPS[0].title })
      for (let i = 0; i < index; i++)
        await user.click(screen.getByRole('button', { name: 'Next' }))
      await user.click(screen.getByRole('button', { name: 'Skip' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(localStorage.getItem(KEY)).toBe('true')
    }
  )

  it('dismisses on Escape without forwarding it to the graph or blocking later keys', async () => {
    const user = userEvent.setup()
    const escaped = vi.fn()
    window.addEventListener('keydown', escaped)
    const { unmount } = mount()
    await screen.findByRole('dialog', { name: STEPS[0].title })
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(localStorage.getItem(KEY)).toBe('true')
    expect(escaped).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    expect(escaped).toHaveBeenCalledTimes(1)
    unmount()
    await user.keyboard('{Escape}')
    expect(escaped).toHaveBeenCalledTimes(2)
    window.removeEventListener('keydown', escaped)
  })

  it('keeps keyboard focus inside the tour', async () => {
    const user = userEvent.setup()
    mount()
    await screen.findByRole('dialog', { name: STEPS[0].title })
    const skip = screen.getByRole('button', { name: 'Skip' })
    expect(skip).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus()
    await user.tab()
    expect(skip).toHaveFocus()
  })

  it('places each card against its intended surface and moves the spotlight with it', async () => {
    const user = userEvent.setup()
    mount()
    for (const [index, step] of STEPS.entries()) {
      const dialog = await screen.findByRole('dialog', { name: step.title })
      const targetRect = rectangles[step.target.slice(1)]
      await waitFor(() => {
        const left = parseFloat(dialog.style.left)
        const top = parseFloat(dialog.style.top)
        const right = left + dialog.offsetWidth
        const bottom = top + dialog.offsetHeight
        expect(left).toBeGreaterThanOrEqual(8)
        expect(top).toBeGreaterThanOrEqual(8)
        expect(right).toBeLessThanOrEqual(window.innerWidth - 8)
        expect(bottom).toBeLessThanOrEqual(window.innerHeight - 8)
        if (step.placement === 'graph-bottom') {
          const center = targetRect.left + targetRect.width / 2
          expect(left).toBeLessThan(center)
          expect(right).toBeGreaterThan(center)
          expect(top).toBeGreaterThanOrEqual(targetRect.top)
          expect(bottom).toBeLessThanOrEqual(rectangles.toolbar.top)
        } else {
          expect(right).toBeLessThanOrEqual(targetRect.left)
          expect(top).toBeLessThan(targetRect.bottom)
          expect(bottom).toBeGreaterThan(targetRect.top)
        }
      })
      const spotlight = screen.getByTestId('agent-coach-spotlight')
      expect(parseFloat(spotlight.style.left)).toBe(targetRect.left)
      expect(parseFloat(spotlight.style.top)).toBe(targetRect.top)
      expect(parseFloat(spotlight.style.width)).toBe(targetRect.width)
      if (index < 3)
        await user.click(screen.getByRole('button', { name: 'Next' }))
    }
  })

  it('keeps the card reachable when the viewport narrows or shortens', async () => {
    mount()
    const dialog = await screen.findByRole('dialog', { name: STEPS[0].title })
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      700
    )
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      240
    )
    window.innerWidth = 700
    window.innerHeight = 240
    window.dispatchEvent(new Event('resize'))
    await waitFor(() => {
      expect(parseFloat(dialog.style.left)).toBeGreaterThanOrEqual(8)
      expect(
        parseFloat(dialog.style.left) + dialog.offsetWidth
      ).toBeLessThanOrEqual(window.innerWidth - 8)
      expect(
        parseFloat(dialog.style.top) + dialog.offsetHeight
      ).toBeLessThanOrEqual(window.innerHeight - 8)
      expect(parseFloat(dialog.style.top)).toBeGreaterThanOrEqual(8)
    })
  })

  it('neither completes the tour nor signals the overlay while its target is absent', async () => {
    const overlay = useOnboardingOverlayStore()
    render(OnboardingCoach, {
      props: { steps: STEPS, storageKey: KEY },
      global: { plugins: [i18n] }
    })
    await nextTick()
    await nextTick()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(localStorage.getItem(KEY)).toBe('false')
    expect(overlay.active).toBe(false)
  })

  it('signals the onboarding overlay while running and clears it when dismissed', async () => {
    const overlay = useOnboardingOverlayStore()
    const user = userEvent.setup()
    mount()
    await screen.findByRole('dialog', { name: STEPS[0].title })
    expect(overlay.active).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(overlay.active).toBe(false)
  })

  it('clears the onboarding overlay signal when it unmounts mid-tour', async () => {
    const overlay = useOnboardingOverlayStore()
    const { unmount } = mount()
    await screen.findByRole('dialog', { name: STEPS[0].title })
    expect(overlay.active).toBe(true)

    unmount()
    expect(overlay.active).toBe(false)
  })

  it('reports an already-seen tour once per key however often it remounts', async () => {
    const notShown = vi.mocked(useTelemetry()!.trackAgentOnboardingNotShown)
    const mountSeen = (storageKey: string) => {
      localStorage.setItem(storageKey, 'true')
      return render(OnboardingCoach, {
        props: { steps: STEPS, storageKey },
        global: { plugins: [i18n] }
      })
    }

    mountSeen('coach-seen-a').unmount()
    mountSeen('coach-seen-a')
    expect(notShown).toHaveBeenCalledExactlyOnceWith({ reason: 'already_seen' })

    mountSeen('coach-seen-b')
    expect(notShown).toHaveBeenCalledTimes(2)
  })

  it('reports a target that never mounts once the grace period passes, once', async () => {
    vi.useFakeTimers()
    try {
      const notShown = vi.mocked(useTelemetry()!.trackAgentOnboardingNotShown)
      notShown.mockClear()
      vi.mocked(reportError).mockClear()
      render(OnboardingCoach, {
        props: {
          steps: [{ ...STEPS[0], target: '#never-mounts' }],
          storageKey: 'coach-missing-test'
        },
        global: { plugins: [i18n] }
      })

      await vi.advanceTimersByTimeAsync(7_999)
      expect(reportError).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(notShown).toHaveBeenCalledExactlyOnceWith({
        reason: 'target_missing'
      })
      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'agent_onboarding_target_missing'
        })
      )

      await vi.advanceTimersByTimeAsync(8_000)
      expect(reportError).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('stays quiet when the target arrives inside the grace period', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(reportError).mockClear()
      render(OnboardingCoach, {
        props: {
          steps: [{ ...STEPS[0], target: '#arrives-late' }],
          storageKey: 'coach-late-ok-test'
        },
        global: { plugins: [i18n] }
      })
      await vi.advanceTimersByTimeAsync(5_000)
      const target = document.createElement('div')
      target.id = 'arrives-late'
      document.body.appendChild(target)

      await vi.advanceTimersByTimeAsync(10_000)

      expect(reportError).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('stays quiet when it unmounts before the grace period ends', async () => {
    vi.useFakeTimers()
    try {
      const { unmount } = render(OnboardingCoach, {
        props: {
          steps: [{ ...STEPS[0], target: '#panel-closed' }],
          storageKey: 'coach-unmounted-test'
        },
        global: { plugins: [i18n] }
      })
      await vi.advanceTimersByTimeAsync(5_000)
      unmount()

      await vi.advanceTimersByTimeAsync(10_000)

      expect(reportError).not.toHaveBeenCalled()
      expect(
        useTelemetry()!.trackAgentOnboardingNotShown
      ).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('waits for a late target without letting Escape complete an unseen tour', async () => {
    const storageKey = 'coach-late-target-test'
    const lateSteps = [{ ...STEPS[0], target: '#late-panel' }]
    render(OnboardingCoach, {
      props: { steps: lateSteps, storageKey },
      global: { plugins: [i18n] }
    })
    await nextTick()
    await nextTick()

    await userEvent.keyboard('{Escape}')
    expect(localStorage.getItem(storageKey)).toBe('false')
    expect(screen.queryByRole('dialog')).toBeNull()

    const target = document.createElement('div')
    target.id = 'late-panel'
    document.body.appendChild(target)

    const dialog = await screen.findByRole('dialog', {
      name: lateSteps[0].title
    })
    await waitFor(() => expect(dialog).toBeVisible())
    expect(useOnboardingOverlayStore().active).toBe(true)
  })
})
