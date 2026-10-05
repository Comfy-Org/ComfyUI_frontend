import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import type { FakeImageDecoder } from '@/test/fakeImageDecoder'
import { stubImageDecoder } from '@/test/fakeImageDecoder'
import {
  setAllIntersecting,
  stubIntersectionObserver
} from '@/test/fakeIntersectionObserver'
import { useFrameScrub } from './useFrameScrub'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock(import('./useReducedMotion'), () => ({
  prefersReducedMotion: () => motion.reduced
}))

let decoder: FakeImageDecoder
let urls: string[]

function renderScrub() {
  render(
    defineComponent({
      setup() {
        const canvas = ref<HTMLCanvasElement>()
        const { isPlaying } = useFrameScrub(canvas, {
          urls,
          scrollTrigger: (trigger) => ({ trigger })
        })
        return () => [
          h('canvas', { ref: canvas }),
          h('p', { 'data-testid': 'playing' }, String(isPlaying.value))
        ]
      }
    })
  )
}

const playing = () => screen.getByTestId('playing').textContent

describe('useFrameScrub', () => {
  beforeEach(() => {
    motion.reduced = false
    stubIntersectionObserver()
    decoder = stubImageDecoder()
    urls = ['a.webp', 'b.webp', 'c.webp'].map((url) =>
      decoder.frame(url, 10, 10)
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      drawImage: vi.fn()
    } as unknown as CanvasRenderingContext2D)
  })

  it('loads no frame until the canvas nears the viewport, then plays', async () => {
    renderScrub()

    await setAllIntersecting(false)
    expect(decoder.decoded).toEqual([])
    expect(playing()).toBe('false')

    await setAllIntersecting(true)
    await waitFor(() => expect(playing()).toBe('true'))
    expect(decoder.decoded).toEqual(urls)
  })

  it('loads nothing for a visitor who prefers reduced motion', async () => {
    motion.reduced = true
    renderScrub()

    await setAllIntersecting(true)

    expect(decoder.decoded).toEqual([])
    expect(playing()).toBe('false')
  })
})
