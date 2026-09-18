import { render, screen, waitFor } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { defineComponent, h, ref } from 'vue'

import type { FrameSource } from '../config/workshop-model-restrictions'
import { useFrameRatioMismatch } from './useFrameRatioMismatch'

// The answer turns on pixels the DOM only knows after a decode, so the decoder
// is the one thing these tests stand in for.
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

interface Frames {
  first?: FrameSource
  last?: FrameSource
}

function frame(url: string, width: number, height: number): FrameSource {
  sizes.set(url, { width, height })
  return { url }
}

function renderMismatch(frames: Ref<Frames>) {
  render(
    defineComponent({
      setup() {
        const mismatch = useFrameRatioMismatch(
          () => frames.value.first,
          () => frames.value.last
        )
        return () =>
          h('p', { 'data-testid': 'mismatch' }, String(mismatch.value))
      }
    })
  )
}

const reported = () => screen.getByTestId('mismatch').textContent

/**
 * A false reading proves nothing until the pair has actually been measured: a
 * bare assertion is satisfied by the tick before the decode, whatever the
 * composable would go on to decide.
 */
async function quietOnceMeasured(...urls: string[]) {
  await waitFor(() => expect(decoded).toEqual(expect.arrayContaining(urls)))
  expect(reported()).toBe('false')
}

beforeEach(() => {
  vi.stubGlobal('Image', StubImage)
})

afterEach(() => {
  sizes.clear()
  decoded.length = 0
})

describe('useFrameRatioMismatch', () => {
  it('reports a mismatch when the frames are shaped differently', async () => {
    renderMismatch(
      ref({
        first: frame('first.png', 1920, 1080),
        last: frame('last.png', 1080, 1920)
      })
    )

    await waitFor(() => expect(reported()).toBe('true'))
  })

  it.for([
    ['the frames share a shape', 1280, 720],
    ['the frames are identical', 1920, 1080]
  ] as const)('stays quiet when %s', async ([, width, height]) => {
    renderMismatch(
      ref({
        first: frame('first.png', 1920, 1080),
        last: frame('last.png', width, height)
      })
    )

    await quietOnceMeasured('first.png', 'last.png')
  })

  it('stays quiet until both frames are chosen', async () => {
    renderMismatch(ref({ first: frame('first.png', 1920, 1080) }))

    await quietOnceMeasured('first.png')
  })

  // Replacing a frame is the ordinary way out of the warning, and it is a
  // different path from arriving already matched: the answer has to change.
  it('drops the mismatch when the last frame is replaced with a matching shape', async () => {
    const frames = ref<Frames>({
      first: frame('first.png', 1920, 1080),
      last: frame('last.png', 1080, 1920)
    })
    renderMismatch(frames)
    await waitFor(() => expect(reported()).toBe('true'))

    frames.value = {
      ...frames.value,
      last: frame('last-match.png', 1280, 720)
    }

    // Anchored to the replacement's own decode: a replaced frame is briefly
    // unmeasured, and the answer is false in that window whatever the ratios.
    await quietOnceMeasured('last-match.png')
  })

  // A frame the browser cannot decode never fires onload, so the pair stays
  // unmeasured and nobody is told about a ratio nobody read.
  it('stays quiet when a frame cannot be decoded', async () => {
    renderMismatch(
      ref({
        first: frame('first.png', 1920, 1080),
        last: { url: 'broken.png' }
      })
    )

    await quietOnceMeasured('first.png')
  })
})
