// @vitest-environment happy-dom
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { t } from '../../i18n/translations'
import {
  setAllIntersecting,
  stubIntersectionObserver
} from '../../test/fakeIntersectionObserver'
import ServerlessHowItWorksSection from './ServerlessHowItWorksSection.vue'

describe('ServerlessHowItWorksSection', () => {
  let visibilityState: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stubIntersectionObserver()
    visibilityState = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible')
  })

  it('presents three unnumbered cards from workflow JSON to applications', () => {
    render(ServerlessHowItWorksSection, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        name: t('platform.serverlessDeploy.heading', 'en')
      })
    ).toBeTruthy()
    expect(screen.getByRole('list')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.queryByText('1')).toBeNull()
    expect(screen.queryByText('2')).toBeNull()
    expect(screen.queryByText('3')).toBeNull()
    for (const step of [1, 2, 3] as const) {
      expect(
        screen.getByText(t(`platform.howItWorks.${step}.title`, 'en'))
      ).toBeTruthy()
    }
  })

  it('localizes the step copy for zh-CN', () => {
    render(ServerlessHowItWorksSection, { props: { locale: 'zh-CN' } })

    expect(
      screen.getByText(t('platform.howItWorks.1.title', 'zh-CN'))
    ).toBeTruthy()
  })

  it('animates connectors only while the section and tab are visible', async () => {
    const { container } = render(ServerlessHowItWorksSection)

    await setAllIntersecting(true)
    expect(container.querySelectorAll('.animate-dash-flow')).toHaveLength(6)
    expect(container.querySelectorAll('animateMotion')).toHaveLength(3)

    await setAllIntersecting(false)
    expect(container.querySelectorAll('.animate-dash-flow')).toHaveLength(0)
    expect(container.querySelectorAll('animateMotion')).toHaveLength(0)

    await setAllIntersecting(true)
    visibilityState.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick()
    expect(container.querySelectorAll('.animate-dash-flow')).toHaveLength(0)
  })

  it('shuffles outlines without restarting orbits and pauses changes offscreen', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.4)
    const { container, unmount } = render(ServerlessHowItWorksSection)
    await setAllIntersecting(true)

    const motions = [...container.querySelectorAll('animateMotion')]
    const dottedMember = () =>
      container
        .querySelector('circle[stroke-dasharray]')
        ?.parentElement?.textContent.trim()
    expect(dottedMember()).toBe('JP')

    await vi.advanceTimersByTimeAsync(5000)
    expect(dottedMember()).toBe('BH')
    for (const motion of motions) {
      expect(container.contains(motion)).toBe(true)
    }

    await setAllIntersecting(false)
    const pausedMember = dottedMember()
    await vi.advanceTimersByTimeAsync(15000)
    expect(dottedMember()).toBe(pausedMember)

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(5000)
    expect(dottedMember()).toBe('JP')
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(15000)
    expect(vi.getTimerCount()).toBe(0)
  })
})
