import { render, screen, waitFor } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FrameSource } from '../../config/workshop-model-restrictions'
import FrameRatioNotice from './FrameRatioNotice.vue'

// The notice exists to read pixels the DOM only knows after a decode, so the
// decoder is the one thing these tests stand in for.
const sizes = new Map<string, { width: number; height: number }>()
const decoded: string[] = []

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
    queueMicrotask(() => {
      decoded.push(value)
      this.onload?.()
    })
  }
  get src(): string {
    return this.#src
  }
}

function frame(url: string, width: number, height: number): FrameSource {
  sizes.set(url, { width, height })
  return { url }
}

/**
 * Absence proves nothing until the pair has actually been measured: a bare
 * assertion that the notice is missing is satisfied by the tick before the
 * decode, whatever the component would go on to decide.
 */
async function silentOnceMeasured(...urls: string[]) {
  await waitFor(() => expect(decoded).toEqual(expect.arrayContaining(urls)))
  expect(screen.queryByTestId('frame-ratio-notice')).toBeNull()
}

beforeEach(() => {
  vi.stubGlobal('Image', StubImage)
})

afterEach(() => {
  sizes.clear()
  decoded.length = 0
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

    await silentOnceMeasured('first.png', 'last.png')
  })

  it('stays silent until both frames are chosen', async () => {
    render(FrameRatioNotice, {
      props: { first: frame('first.png', 1920, 1080) }
    })

    await silentOnceMeasured('first.png')
  })

  // Replacing a frame is the ordinary way out of the warning, and it is a
  // different path from arriving already matched: the notice has to come down.
  it('retires the notice when the last frame is replaced with a matching shape', async () => {
    const { rerender } = render(FrameRatioNotice, {
      props: {
        first: frame('first.png', 1920, 1080),
        last: frame('last.png', 1080, 1920)
      }
    })
    await screen.findByTestId('frame-ratio-notice')

    await rerender({ last: frame('last-match.png', 1280, 720) })

    // Anchored to the replacement's own decode: a replaced frame is briefly
    // unmeasured, and the notice is down in that window whatever the ratios.
    await silentOnceMeasured('last-match.png')
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

    await silentOnceMeasured('first.png')
  })
})
