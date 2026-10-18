import userEvent from '@testing-library/user-event'
import * as VueUse from '@vueuse/core'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import NativeCliSession from './NativeCliSession.vue'

const preference = vi.hoisted(() => ({ reduced: false }))
const visibility = ref(true)
vi.mock(import('@/composables/useReducedMotion'), () => ({
  prefersReducedMotion: () => preference.reduced
}))
vi.mock(import('@vueuse/core'), { spy: true })
beforeEach(() => {
  vi.spyOn(VueUse, 'useElementVisibility').mockReturnValue(
    Object.assign(visibility, {
      isVisible: visibility,
      isSupported: computed(() => true),
      isActive: ref(true),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn()
    })
  )
  preference.reduced = false
  visibility.value = true
  vi.useFakeTimers()
})
describe('native CLI recorded session', () => {
  it('types, pauses with Space, reveals both saved outputs, and replays', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { unmount } = render(NativeCliSession)
    await nextTick()
    const group = screen.getByRole('group', { name: /CLI session animation/ })
    expect(group).toHaveAttribute('data-phase', 'terminal')
    expect(screen.queryAllByText(/.*/, { selector: 'details' })).toHaveLength(0)
    expect(
      screen.getByText(/comfy generate flux-pro/, { selector: 'pre.sr-only' })
    ).toHaveTextContent('comfy generate flux-pro')
    await user.click(group)
    await user.keyboard(' ')
    expect(group).toHaveAttribute('data-paused', 'true')
    await vi.advanceTimersByTimeAsync(36000)
    expect(group).toHaveAttribute('data-phase', 'terminal')
    await user.click(screen.getByRole('button', { name: 'Resume' }))
    await vi.advanceTimersByTimeAsync(9000)
    await nextTick()
    expect(group).toHaveAttribute('data-phase', 'results')
    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(
      screen.getByText('cat.png', { selector: 'figcaption' })
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Replay' }))
    expect(group).toHaveAttribute('data-phase', 'terminal')
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('enters three quarters through typing, continues after scrolling, and replays from zero', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(NativeCliSession)
    const group = screen.getByRole('group', { name: /CLI session animation/ })
    expect(group).toHaveAttribute('data-elapsed', '26250')
    await vi.advanceTimersByTimeAsync(1000)
    const progressed = Number(group.getAttribute('data-elapsed'))
    expect(progressed).toBeGreaterThan(26250)
    visibility.value = false
    await vi.advanceTimersByTimeAsync(3000)
    expect(Number(group.getAttribute('data-elapsed'))).toBe(progressed)
    visibility.value = true
    await vi.advanceTimersByTimeAsync(1000)
    expect(Number(group.getAttribute('data-elapsed'))).toBeGreaterThan(
      progressed
    )
    await user.click(screen.getByRole('button', { name: 'Replay' }))
    expect(group).toHaveAttribute('data-elapsed', '0')
  })
  it('shows final outputs without motion or playback controls for reduced motion', () => {
    preference.reduced = true
    render(NativeCliSession)
    expect(
      screen.getByRole('group', { name: /CLI session animation/ })
    ).toHaveAttribute('data-phase', 'results')
    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull()
    expect(
      screen.queryAllByText(/.*/, { selector: 'video, iframe' })
    ).toHaveLength(0)
  })
})
