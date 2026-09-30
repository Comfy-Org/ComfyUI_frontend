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
    await vi.advanceTimersByTimeAsync(3200)

    expect(
      screen.getByText(t('platform.howItWorks.chat.message', 'en'))
    ).toBeTruthy()

    expect(screen.getByText('upscale-4k.run.comfy.app')).toBeTruthy()
    expect(screen.getByText('try-on-x7k2.run.comfy.app')).toBeTruthy()

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('shows a fixed sequence when reduced motion is preferred', async () => {
    vi.useFakeTimers()
    vi.mocked(prefersReducedMotion).mockReturnValue(true)
    const { unmount } = render(TeamSharingChat, {
      props: { locale: 'en' }
    })

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(6400)

    expect(
      screen.queryByText(t('platform.howItWorks.chat.message', 'en'))
    ).toBeNull()
    expect(
      screen.getByText(t('platform.howItWorks.chat.messageReady', 'en'))
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.howItWorks.chat.messagePreview', 'en'))
    ).toBeTruthy()

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
