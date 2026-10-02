import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import { t } from '../../i18n/translations'
import {
  setAllIntersecting,
  stubIntersectionObserver
} from '../../test/fakeIntersectionObserver'
import TeamSharingChat from './TeamSharingChat.vue'

vi.mock(import('../../composables/useReducedMotion'), () => ({
  prefersReducedMotion: vi.fn(() => false)
}))

describe('TeamSharingChat', () => {
  beforeEach(() => {
    stubIntersectionObserver()
    vi.mocked(prefersReducedMotion).mockReturnValue(false)
  })

  it('advances messages while keeping distinct workflow links fixed', async () => {
    vi.useFakeTimers()
    const { unmount } = render(TeamSharingChat, {
      props: { locale: 'en' }
    })

    await setAllIntersecting(true)

    expect(
      screen.getByText(t('platform.howItWorks.chat.message', 'en'))
    ).toBeTruthy()
    expect(screen.getByText('video-upscale-4k.run.comfy.app')).toBeTruthy()

    await vi.advanceTimersByTimeAsync(1600 * 2)

    // The window slides one message at a time, so the tail of the M/B
    // exchange (its workflow link) and the head of the S/B exchange are
    // both visible at once.
    expect(
      screen.getByText(t('platform.howItWorks.chat.messageBgRemove', 'en'))
    ).toBeTruthy()
    expect(screen.getByText('video-upscale-4k.run.comfy.app')).toBeTruthy()
    expect(screen.getByText('bg-remove-batch.run.comfy.app')).toBeTruthy()

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cycles through all three exchanges (M/B, S/B, R/B) and loops', async () => {
    vi.useFakeTimers()
    const { unmount } = render(TeamSharingChat, {
      props: { locale: 'en' }
    })

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(1600 * 5)

    expect(
      screen.getByText(t('platform.howItWorks.chat.messageProductShots', 'en'))
    ).toBeTruthy()
    expect(screen.getByText('product-shots.run.comfy.app')).toBeTruthy()

    // The cycle wraps: a little further on, the M/B exchange that opened
    // the loop is back in view.
    await vi.advanceTimersByTimeAsync(1600 * 3)
    expect(
      screen.getByText(t('platform.howItWorks.chat.message', 'en'))
    ).toBeTruthy()
    expect(screen.getByText('video-upscale-4k.run.comfy.app')).toBeTruthy()

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('shows one complete, un-cut exchange when reduced motion is preferred', async () => {
    vi.useFakeTimers()
    vi.mocked(prefersReducedMotion).mockReturnValue(true)
    const { unmount } = render(TeamSharingChat, {
      props: { locale: 'en' }
    })

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(6400)

    expect(
      screen.getByText(t('platform.howItWorks.chat.message', 'en'))
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.howItWorks.chat.reply', 'en'))
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.howItWorks.chat.thanks', 'en'))
    ).toBeTruthy()
    expect(
      screen.queryByText(t('platform.howItWorks.chat.messageBgRemove', 'en'))
    ).toBeNull()

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
