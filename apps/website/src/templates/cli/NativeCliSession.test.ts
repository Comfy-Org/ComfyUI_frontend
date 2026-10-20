import userEvent from '@testing-library/user-event'
import * as VueUse from '@vueuse/core'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { translationsFor } from '@/i18n/translations'
import SessionSection from './SessionSection.vue'
import NativeCliSession from './NativeCliSession.vue'

import { prefersReducedMotion } from '@/composables/useReducedMotion'
const visibility = ref(true)
vi.mock(import('@/composables/useReducedMotion'), () => ({
  prefersReducedMotion: vi.fn(() => false)
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
  vi.mocked(prefersReducedMotion).mockReturnValue(false)
  visibility.value = true
})
describe('native CLI recorded session', () => {
  it('can pause by tapping the session and resume with the keyboard when the footer is hidden', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(NativeCliSession, { props: { showFooter: false } })
    const pause = screen.getByRole('button', {
      name: 'Pause CLI session animation'
    })
    const session = screen.getByRole('group', { name: /CLI session animation/ })
    await user.click(pause)
    const elapsed = session.getAttribute('data-elapsed')
    await vi.advanceTimersByTimeAsync(1000)
    expect(session).toHaveAttribute('data-elapsed', elapsed)
    expect(
      screen.getByRole('button', {
        name: 'Resume CLI session animation'
      })
    ).toBeVisible()
    await user.keyboard('{Enter}')
    await vi.advanceTimersByTimeAsync(1000)
    expect(Number(session.getAttribute('data-elapsed'))).toBeGreaterThan(
      Number(elapsed)
    )
    await user.keyboard(' ')
    expect(
      screen.getByRole('button', { name: 'Resume CLI session animation' })
    ).toBeVisible()
  })
  it('types, pauses with Space, reveals both saved outputs, and replays', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { unmount } = render(NativeCliSession)
    await nextTick()
    const group = screen.getByRole('group', { name: /CLI session animation/ })
    await user.click(screen.getByRole('button', { name: 'Replay' }))
    await vi.advanceTimersByTimeAsync(2000)
    const prefix = screen.getByText(
      (_, element) =>
        element instanceof HTMLParagraphElement &&
        element.textContent.startsWith('$ comfy gene')
    )
    expect(prefix).toBeVisible()
    expect(prefix).not.toHaveTextContent('cat.png')
    const initialText = prefix.textContent
    await vi.advanceTimersByTimeAsync(3000)
    expect(prefix.textContent.length).toBeGreaterThan(initialText.length)
    const pausedText = prefix.textContent
    await user.click(group)
    await user.keyboard(' ')
    await vi.advanceTimersByTimeAsync(3000)
    expect(prefix).toHaveTextContent(pausedText)
    await user.click(screen.getByRole('button', { name: 'Resume' }))
    await vi.advanceTimersByTimeAsync(6500)
    expect(
      screen.getByText(
        (_, element) =>
          element instanceof HTMLParagraphElement &&
          /Request accepted/.test(element.textContent)
      )
    ).toBeVisible()
    await vi.advanceTimersByTimeAsync(25000)
    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(
      screen.getByText('cat.png', { selector: 'figcaption' })
    ).toBeVisible()
    expect(
      screen.getByText('f5308bc5_000.png', { selector: 'figcaption' })
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
    expect(
      screen.getByText(
        (_, element) =>
          element instanceof HTMLParagraphElement &&
          element.textContent.startsWith('$ comfy workflow set-slot')
      )
    ).toBeVisible()
    const initial = Number(group.getAttribute('data-elapsed'))
    await vi.advanceTimersByTimeAsync(1000)
    const progressed = Number(group.getAttribute('data-elapsed'))
    expect(progressed).toBeGreaterThan(initial)
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
  it('shows final outputs without motion or playback controls for reduced motion', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.mocked(prefersReducedMotion).mockReturnValue(true)
    render(NativeCliSession)
    expect(
      screen.getByRole('group', {
        name: 'CLI session: final outputs shown with reduced motion.'
      })
    ).toHaveAttribute('data-phase', 'results')
    const group = screen.getByRole('group')
    await user.click(group)
    await user.keyboard(' ')
    expect(group).toHaveAttribute('data-paused', 'false')
    expect(group).not.toHaveAccessibleName(/Press Space/)
    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull()
    expect(
      screen.queryAllByText(/.*/, { selector: 'video, iframe' })
    ).toHaveLength(0)
  })
})

it('exposes one localized transcript on the Chinese session', () => {
  const { t } = translationsFor('zh-CN')
  render(SessionSection, { props: { locale: 'zh-CN' } })
  expect(screen.getAllByText(t('cli.session.transcript'))).toHaveLength(1)
  expect(
    screen.queryByText(translationsFor('en').t('cli.session.transcript'))
  ).toBeNull()
  expect(
    screen.getByRole('group', { name: t('cli.session.animationLabel') })
  ).toBeVisible()
})

it('stops requesting frames while paused or outside the viewport and restarts when visible', async () => {
  const request = vi.spyOn(window, 'requestAnimationFrame')
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(NativeCliSession)
  await user.click(screen.getByRole('button', { name: 'Pause' }))
  request.mockClear()
  await vi.advanceTimersByTimeAsync(1000)
  expect(request).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Resume' }))
  expect(request).toHaveBeenCalled()
  visibility.value = false
  await nextTick()
  request.mockClear()
  await vi.advanceTimersByTimeAsync(1000)
  expect(request).not.toHaveBeenCalled()
  visibility.value = true
  await nextTick()
  expect(request).toHaveBeenCalled()
})

it('never requests animation frames with reduced motion', async () => {
  vi.mocked(prefersReducedMotion).mockReturnValue(true)
  const request = vi.spyOn(window, 'requestAnimationFrame')
  render(NativeCliSession)
  await vi.advanceTimersByTimeAsync(1000)
  expect(request).not.toHaveBeenCalled()
})

it('suspends playback in a hidden document and resumes when visible', async () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  const request = vi.spyOn(window, 'requestAnimationFrame')
  render(NativeCliSession)
  const group = screen.getByRole('group', { name: /CLI session animation/ })
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  document.dispatchEvent(new Event('visibilitychange'))
  await nextTick()
  const elapsed = group.getAttribute('data-elapsed')
  request.mockClear()
  await vi.advanceTimersByTimeAsync(1000)
  expect(request).not.toHaveBeenCalled()
  expect(group).toHaveAttribute('data-elapsed', elapsed)
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  document.dispatchEvent(new Event('visibilitychange'))
  await nextTick()
  expect(request).toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1000)
  expect(Number(group.getAttribute('data-elapsed'))).toBeGreaterThan(
    Number(elapsed)
  )
})
