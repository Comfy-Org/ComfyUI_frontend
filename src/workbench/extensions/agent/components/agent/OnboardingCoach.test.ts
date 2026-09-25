import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { i18n } from '@/i18n'
import { useOnboardingOverlayStore } from '@/platform/onboarding/onboardingOverlayStore'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import type { CoachStep } from '../../composables/agent/useOnboarding'

import OnboardingCoach from './OnboardingCoach.vue'

vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const telemetry = () => vi.mocked(useTelemetry())!

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
  telemetry().trackAgentOnboardingShown.mockClear()
  telemetry().trackAgentOnboardingStep.mockClear()
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

  it('reports the card as shown once it is on screen, and not before', async () => {
    const storageKey = 'coach-shown-telemetry-test'
    const lateSteps = [{ ...STEPS[0], target: '#late-shown-panel' }]
    render(OnboardingCoach, {
      props: { steps: lateSteps, storageKey },
      global: { plugins: [i18n] }
    })
    await nextTick()
    await nextTick()
    expect(telemetry().trackAgentOnboardingShown).not.toHaveBeenCalled()

    const target = document.createElement('div')
    target.id = 'late-shown-panel'
    document.body.appendChild(target)

    await screen.findByRole('dialog', { name: lateSteps[0].title })
    expect(telemetry().trackAgentOnboardingShown).toHaveBeenCalledTimes(1)
  })

  it('reports the card as shown once across the whole tour', async () => {
    const user = userEvent.setup()
    mount()
    await screen.findByRole('dialog', { name: STEPS[0].title })
    for (const index of STEPS.keys())
      await user.click(
        screen.getByRole('button', { name: index === 3 ? 'Done' : 'Next' })
      )
    expect(telemetry().trackAgentOnboardingShown).toHaveBeenCalledTimes(1)
  })

  it.for([
    { advance: 0, dismiss: 'Next', step: 1, action: 'next' },
    { advance: 2, dismiss: 'Next', step: 3, action: 'next' },
    { advance: 3, dismiss: 'Done', step: 4, action: 'finish' },
    { advance: 0, dismiss: 'Skip', step: 1, action: 'skip' },
    { advance: 2, dismiss: 'Skip', step: 3, action: 'skip' },
    { advance: 1, dismiss: 'Escape', step: 2, action: 'skip' }
  ])(
    'reports $dismiss on card $step as action $action',
    async ({ advance, dismiss, step, action }) => {
      const user = userEvent.setup()
      mount()
      await screen.findByRole('dialog', { name: STEPS[0].title })
      for (let i = 0; i < advance; i++)
        await user.click(screen.getByRole('button', { name: 'Next' }))
      telemetry().trackAgentOnboardingStep.mockClear()

      if (dismiss === 'Escape') await user.keyboard('{Escape}')
      else await user.click(screen.getByRole('button', { name: dismiss }))

      expect(telemetry().trackAgentOnboardingStep.mock.calls).toEqual([
        [{ step, action }]
      ])
    }
  )

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

  describe('reporting a step whose target never mounts', () => {
    const renderMissing = (target: string) =>
      render(OnboardingCoach, {
        props: {
          steps: [{ ...STEPS[0], target }],
          storageKey: `coach-missing-${target}`
        },
        global: { plugins: [i18n] }
      })

    it('reports only once the grace period has passed', async () => {
      renderMissing('#never-a')

      await vi.advanceTimersByTimeAsync(7_000)
      expect(reportError).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1_000)
      expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.any(Error), {
        errorType: 'failure_locating_agent_coach_target',
        level: 'warning',
        context: { target: '#never-a', step: 1 }
      })
      expect(
        useTelemetry()!.trackAgentOnboardingNotShown
      ).toHaveBeenCalledExactlyOnceWith({ reason: 'target_missing', step: 1 })
    })

    it('reports a target once per session however often the panel remounts', async () => {
      renderMissing('#never-b').unmount()
      renderMissing('#never-b')
      await vi.advanceTimersByTimeAsync(8_000)
      renderMissing('#never-b')
      await vi.advanceTimersByTimeAsync(8_000)

      expect(reportError).toHaveBeenCalledOnce()
    })

    it('re-arms for a later step whose target is missing', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const found = document.createElement('div')
      found.id = 'found-e'
      document.body.appendChild(found)
      render(OnboardingCoach, {
        props: {
          steps: [
            { ...STEPS[0], target: '#found-e' },
            { ...STEPS[1], target: '#never-e' }
          ],
          storageKey: 'coach-missing-rearm'
        },
        global: { plugins: [i18n] }
      })
      await user.click(await screen.findByRole('button', { name: 'Next' }))

      await vi.advanceTimersByTimeAsync(8_000)

      expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.any(Error), {
        errorType: 'failure_locating_agent_coach_target',
        level: 'warning',
        context: { target: '#never-e', step: 2 }
      })
    })

    it('stays quiet when the target arrives inside the grace period', async () => {
      renderMissing('#late-c')
      await vi.advanceTimersByTimeAsync(5_000)
      const target = document.createElement('div')
      target.id = 'late-c'
      document.body.appendChild(target)

      await vi.advanceTimersByTimeAsync(10_000)

      expect(reportError).not.toHaveBeenCalled()
    })

    it('stays quiet for a user who already finished the tour', async () => {
      localStorage.setItem('coach-missing-#never-f', 'true')
      renderMissing('#never-f')

      await vi.advanceTimersByTimeAsync(10_000)

      expect(reportError).not.toHaveBeenCalled()
    })

    it('stays quiet when the panel closes before the grace period ends', async () => {
      const { unmount } = renderMissing('#never-d')
      await vi.advanceTimersByTimeAsync(5_000)
      unmount()

      await vi.advanceTimersByTimeAsync(10_000)

      expect(reportError).not.toHaveBeenCalled()
    })
  })
})
