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

  it('shows the scripted exchange and loops it with the workflow link fixed', async () => {
    vi.useFakeTimers()
    const { unmount } = render(TeamSharingChat, {
      props: { locale: 'en' }
    })

    await setAllIntersecting(true)

    expect(
      screen.getByText(t('platform.howItWorks.chat.message', 'en'))
    ).toBeTruthy()
    expect(screen.getByText('video-upscale-4k.run.comfy.app')).toBeTruthy()

    await vi.advanceTimersByTimeAsync(1600 * 3)

    // The script loops: after a full cycle, the same question and workflow
    // link are showing again rather than advancing to something new.
    expect(
      screen.getByText(t('platform.howItWorks.chat.message', 'en'))
    ).toBeTruthy()
    expect(screen.getByText('video-upscale-4k.run.comfy.app')).toBeTruthy()

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('shows the full fixed exchange when reduced motion is preferred', async () => {
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

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
