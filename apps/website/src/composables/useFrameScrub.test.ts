import { render, waitFor } from '@testing-library/vue'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import type { FakeImageDecoder } from '@/test/fakeImageDecoder'
import { stubImageDecoder } from '@/test/fakeImageDecoder'
import type { FakeIntersectionObserver } from '@/test/fakeIntersectionObserver'
import {
  setAllIntersecting,
  stubIntersectionObserver
} from '@/test/fakeIntersectionObserver'
import { useFrameScrub } from './useFrameScrub'

const reducedMotion = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return ref(false)
})

vi.mock(import('./useReducedMotion'), () => ({
  prefersReducedMotion: () => reducedMotion.value
}))

let observers: typeof FakeIntersectionObserver
let decoder: FakeImageDecoder
let urls: string[]
let drawImage: Mock<(...args: unknown[]) => void>
let drawnOn: Set<string | null>

function renderScrub(name = 'scrub') {
  return render(
    defineComponent({
      setup() {
        const canvas = ref<HTMLCanvasElement>()
        useFrameScrub(canvas, {
          urls,
          scrollTrigger: (trigger) => ({ trigger })
        })
        return () => h('canvas', { ref: canvas, 'data-testid': name })
      }
    })
  )
}

describe('useFrameScrub', () => {
  beforeEach(() => {
    reducedMotion.value = false
    observers = stubIntersectionObserver()
    decoder = stubImageDecoder()
    urls = ['a.webp', 'b.webp', 'c.webp'].map((url) =>
      decoder.frame(url, 10, 10)
    )
    drawImage = vi.fn()
    drawnOn = new Set()
    const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
    vi.mocked(context, { partial: true }).mockImplementation(
      function (this: HTMLCanvasElement) {
        return {
          clearRect: vi.fn(),
          drawImage: (...args: unknown[]) => {
            drawnOn.add(this.dataset.testid ?? null)
            drawImage(...args)
          }
        }
      }
    )
  })

  it('loads no frame until the canvas nears the viewport, then plays', async () => {
    renderScrub()

    await setAllIntersecting(false)
    expect(decoder.decoded).toEqual([])
    expect(drawImage).not.toHaveBeenCalled()

    await setAllIntersecting(true)
    await waitFor(() => expect(drawImage).toHaveBeenCalled())
    expect(decoder.decoded).toEqual(urls)
  })

  it('plays when a later entry in one batch intersects', async () => {
    renderScrub()
    await nextTick()

    const [observer] = observers.instances
    const [target] = observer.observed
    observer.callback(
      [false, true].map(
        (isIntersecting) =>
          ({ target, isIntersecting, time: 0 }) as IntersectionObserverEntry
      ),
      observer as unknown as IntersectionObserver
    )

    await waitFor(() => expect(drawImage).toHaveBeenCalled())
  })

  it('loads nothing while the visitor prefers reduced motion, and plays once they stop', async () => {
    reducedMotion.value = true
    renderScrub()

    await setAllIntersecting(true)
    expect(decoder.decoded).toEqual([])
    expect(drawImage).not.toHaveBeenCalled()

    reducedMotion.value = false
    await waitFor(() => expect(drawImage).toHaveBeenCalled())
  })

  it('draws nothing on a canvas that unmounts while frames load', async () => {
    decoder.hold()
    const { unmount } = renderScrub('unmounted')
    renderScrub('kept')
    await setAllIntersecting(true)

    unmount()
    while (decoder.pending.length) decoder.settle(decoder.pending[0])

    await waitFor(() => expect(drawnOn).toContain('kept'))
    expect([...drawnOn]).toEqual(['kept'])
  })

  it('reports a frame that does not load instead of rejecting unhandled', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    urls = [...urls, decoder.broken('missing.webp')]
    renderScrub()

    await setAllIntersecting(true)

    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith(
        'Frame scrub failed to load',
        expect.any(Error)
      )
    )
    expect(drawImage).not.toHaveBeenCalled()
  })
})
