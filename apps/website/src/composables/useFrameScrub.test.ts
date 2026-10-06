import { render, waitFor } from '@testing-library/vue'
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
let drawImage: ReturnType<typeof vi.fn>

function renderScrub() {
  render(
    defineComponent({
      setup() {
        const canvas = ref<HTMLCanvasElement>()
        useFrameScrub(canvas, {
          urls,
          scrollTrigger: (trigger) => ({ trigger })
        })
        return () => h('canvas', { ref: canvas })
      }
    })
  )
}

describe('useFrameScrub', () => {
  beforeEach(() => {
    motion.reduced = false
    stubIntersectionObserver()
    decoder = stubImageDecoder()
    urls = ['a.webp', 'b.webp', 'c.webp'].map((url) =>
      decoder.frame(url, 10, 10)
    )
    drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      drawImage
    } as unknown as CanvasRenderingContext2D)
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

  it('loads nothing for a visitor who prefers reduced motion', async () => {
    motion.reduced = true
    renderScrub()

    await setAllIntersecting(true)

    expect(decoder.decoded).toEqual([])
    expect(drawImage).not.toHaveBeenCalled()
  })
})
