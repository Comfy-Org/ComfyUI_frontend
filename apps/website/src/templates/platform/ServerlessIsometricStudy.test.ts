// @vitest-environment happy-dom
/* eslint-disable testing-library/no-container, testing-library/no-node-access --
 * The study is a decorative aria-hidden SVG with no accessible roles or text;
 * its faces and animation can only be asserted through the DOM. */
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import { t } from '../../i18n/translations'
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
  prefersReducedMotionMock.mockReturnValue(false)
  rafCallbacks = []
  cancelledIds = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    rafCallbacks.push(callback)
    return rafCallbacks.length
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    cancelledIds.push(id)
  })
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private readonly callback: IntersectionObserverCallback) {}

      observe(target: Element) {
        this.callback(
          [
            {
              isIntersecting: true,
              target,
              time: 1
            } as IntersectionObserverEntry
          ],
          this as unknown as IntersectionObserver
        )
      }

      unobserve() {}

      disconnect() {}
    }
  )
  setDocumentVisibility('visible')
})

describe('ServerlessIsometricStudy', () => {
  it('describes the diagram for assistive tech', () => {
    render(ServerlessIsometricStudy, { props: { locale: 'en' } })

    expect(
      screen.getByRole('img', {
        name: t('platform.serverlessVisual.ariaLabel', 'en')
      })
    ).toBeTruthy()
  })

  it('paints every face from a vector gradient, never a raster pattern', () => {
    prefersReducedMotionMock.mockReturnValue(true)
    const { container } = render(ServerlessIsometricStudy, {
      props: { locale: 'en' }
    })

    expect(container.querySelector('pattern')).toBeNull()
    expect(container.querySelector('image')).toBeNull()

    const gradientIds = [...container.querySelectorAll('linearGradient')].map(
      (gradient) => gradient.id
    )
    expect(gradientIds).toHaveLength(3)

    const paintReferences = [...container.querySelectorAll('polygon')]
      .map((polygon) => polygon.getAttribute('fill'))
      .filter((fill) => fill?.startsWith('url('))

    expect(paintReferences.length).toBeGreaterThan(0)
    for (const id of gradientIds) {
      expect(paintReferences).toContain(`url(#${id})`)
    }
  })

  it('stops animating while the page is hidden', async () => {
    render(ServerlessIsometricStudy, { props: { locale: 'en' } })
    await nextTick()

    expect(rafCallbacks.length).toBeGreaterThan(0)
    const scheduled = rafCallbacks.length

    setDocumentVisibility('hidden')
    await nextTick()

    expect(cancelledIds.length).toBeGreaterThan(0)
    rafCallbacks[scheduled - 1]!(16)
    expect(rafCallbacks).toHaveLength(scheduled)
  })
})
