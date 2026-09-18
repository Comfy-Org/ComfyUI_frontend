import { render, screen, waitFor } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FrameSource } from '../../config/workshop-model-restrictions'
import FrameRatioNotice from './FrameRatioNotice.vue'

// The notice exists to read pixels the DOM only knows after a decode, so the
// decoder is the one thing these tests stand in for.
const sizes = new Map<string, { width: number; height: number }>()

class StubImage {
  onload: (() => void) | null = null
  naturalWidth = 0
  naturalHeight = 0
  #src = ''
  set src(value: string) {
    this.#src = value
    const size = sizes.get(value)
    if (!size) return
    this.naturalWidth = size.width
    this.naturalHeight = size.height
    queueMicrotask(() => this.onload?.())
  }
  get src(): string {
    return this.#src
  }
}

function frame(url: string, width: number, height: number): FrameSource {
  sizes.set(url, { width, height })
  return { url }
}

beforeEach(() => {
  vi.stubGlobal('Image', StubImage)
})

afterEach(() => {
  sizes.clear()
})

describe('FrameRatioNotice', () => {
  it('names the stretch when the frames are shaped differently', async () => {
    render(FrameRatioNotice, {
      props: {
        first: frame('first.png', 1920, 1080),
        last: frame('last.png', 1080, 1920)
      }
    })

    const notice = await screen.findByTestId('frame-ratio-notice')
    expect(notice.textContent).toContain('first frame')
  })

  it.for([
    ['the frames share a shape', 1280, 720],
    ['the frames are identical', 1920, 1080]
  ] as const)('stays silent when %s', async ([, width, height]) => {
    render(FrameRatioNotice, {
      props: {
        first: frame('first.png', 1920, 1080),
        last: frame('last.png', width, height)
      }
    })

    await waitFor(() =>
      expect(screen.queryByTestId('frame-ratio-notice')).toBeNull()
    )
  })

  it('stays silent until both frames are chosen', async () => {
    render(FrameRatioNotice, {
      props: { first: frame('first.png', 1920, 1080) }
    })

    await waitFor(() =>
      expect(screen.queryByTestId('frame-ratio-notice')).toBeNull()
    )
  })

  // A frame the browser cannot decode never fires onload, so the pair stays
  // unmeasured and the reader is not told about a ratio nobody read.
  it('stays silent when a frame cannot be decoded', async () => {
    render(FrameRatioNotice, {
      props: {
        first: frame('first.png', 1920, 1080),
        last: { url: 'broken.png' }
      }
    })

    await waitFor(() =>
      expect(screen.queryByTestId('frame-ratio-notice')).toBeNull()
    )
  })
})
