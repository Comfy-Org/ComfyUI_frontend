// @vitest-environment happy-dom
/* eslint-disable testing-library/no-container, testing-library/no-node-access --
 * The study is a decorative aria-hidden SVG with no accessible roles or text;
 * its faces and animation can only be asserted through the DOM. */
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import { t } from '../../i18n/translations'
import {
  setAllIntersecting,
  stubIntersectionObserver
} from '../../test/fakeIntersectionObserver'
import ServerlessIsometricStudy from './ServerlessIsometricStudy.vue'

vi.mock('../../composables/useReducedMotion', () => ({
  prefersReducedMotion: vi.fn(() => false)
}))

const prefersReducedMotionMock = vi.mocked(prefersReducedMotion)

let rafCallbacks: FrameRequestCallback[]
let cancelledIds: number[]

function setDocumentVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  rafCallbacks = []
  cancelledIds = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    rafCallbacks.push(callback)
    return rafCallbacks.length
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    cancelledIds.push(id)
  })
  stubIntersectionObserver()
  setDocumentVisibility('visible')
})

async function renderOnScreen() {
  const view = render(ServerlessIsometricStudy, { props: { locale: 'en' } })
  await setAllIntersecting(true)
  return view
}

describe('ServerlessIsometricStudy', () => {
  it('describes the diagram for assistive tech', () => {
    render(ServerlessIsometricStudy, { props: { locale: 'en' } })

    expect(
      screen.getByRole('img', {
        name: t('platform.serverlessVisual.ariaLabel', 'en')
      })
    ).toBeTruthy()
  })

  it('paints faces with flat colours, never a paint server', () => {
    prefersReducedMotionMock.mockReturnValue(true)
    const { container } = render(ServerlessIsometricStudy, {
      props: { locale: 'en' }
    })

    expect(container.querySelector('defs')).toBeNull()
    expect(container.querySelector('pattern')).toBeNull()
    expect(container.querySelector('image')).toBeNull()

    const fills = [...container.querySelectorAll('polygon')].map((polygon) =>
      polygon.getAttribute('fill')
    )
    const surfaceFills = fills.filter((fill) =>
      fill?.startsWith('color-mix(in srgb, #')
    )

    expect(fills.every((fill) => !fill?.includes('url('))).toBe(true)
    expect(surfaceFills.length).toBeGreaterThan(0)
    expect(new Set(surfaceFills).size).toBeGreaterThan(1)
  })

  it('never schedules a frame when reduced motion is preferred', async () => {
    prefersReducedMotionMock.mockReturnValue(true)
    await renderOnScreen()

    expect(rafCallbacks).toHaveLength(0)
  })

  it('only animates while it is on screen', async () => {
    await renderOnScreen()
    expect(rafCallbacks.length).toBeGreaterThan(0)

    const scheduled = rafCallbacks.length
    await setAllIntersecting(false)

    expect(cancelledIds.length).toBeGreaterThan(0)
    rafCallbacks[scheduled - 1]!(16)
    expect(rafCallbacks).toHaveLength(scheduled)
  })

  it('stops animating while the page is hidden and resumes with it', async () => {
    await renderOnScreen()

    expect(rafCallbacks.length).toBeGreaterThan(0)
    const scheduled = rafCallbacks.length

    setDocumentVisibility('hidden')
    await nextTick()

    expect(cancelledIds.length).toBeGreaterThan(0)
    rafCallbacks[scheduled - 1]!(16)
    expect(rafCallbacks).toHaveLength(scheduled)

    setDocumentVisibility('visible')
    await nextTick()

    expect(rafCallbacks.length).toBeGreaterThan(scheduled)
  })

  it('advances the animation no more often than the frame budget', async () => {
    await renderOnScreen()

    const stage = screen.getByRole('img', {
      name: t('platform.serverlessVisual.ariaLabel', 'en')
    })
    const resting = stage.getAttribute('data-reset-indicator-height')

    rafCallbacks[0]!(100)
    await nextTick()
    rafCallbacks[1]!(116)
    await nextTick()
    expect(stage.getAttribute('data-reset-indicator-height')).toBe(resting)

    rafCallbacks[2]!(140)
    await nextTick()
    expect(stage.getAttribute('data-reset-indicator-height')).not.toBe(resting)
  })
})
