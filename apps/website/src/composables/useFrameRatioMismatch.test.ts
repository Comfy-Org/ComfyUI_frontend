import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Ref } from 'vue'
import { defineComponent, h, nextTick, ref } from 'vue'

import type { FrameSource } from '../config/workshop-model-restrictions'
import type { FakeImageDecoder } from '../test/fakeImageDecoder'
import { stubImageDecoder } from '../test/fakeImageDecoder'
import { useFrameRatioMismatch } from './useFrameRatioMismatch'

interface Frames {
  first?: FrameSource
  last?: FrameSource
}

let decoder: FakeImageDecoder

beforeEach(() => {
  decoder = stubImageDecoder()
})

const frame = (url: string, width: number, height: number): FrameSource => ({
  url: decoder.frame(url, width, height)
})

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
  await waitFor(() =>
    expect(decoder.decoded).toEqual(expect.arrayContaining(urls))
  )
  expect(reported()).toBe('false')
}

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

    frames.value = { ...frames.value, last: frame('last-match.png', 1280, 720) }

    // Anchored to the replacement's own decode: a replaced frame is briefly
    // unmeasured, and the answer is false in that window whatever the ratios.
    await quietOnceMeasured('last-match.png')
  })

  // Decodes finish in whatever order the network allows. A frame replaced
  // before it ever decoded must not land its dimensions afterwards, which is
  // the one behaviour every other case here reaches only by accident.
  it('ignores a decode that finishes after the frame it measured was replaced', async () => {
    decoder.hold()
    const frames = ref<Frames>({
      first: frame('first.png', 1920, 1080),
      last: frame('slow.png', 1080, 1920)
    })
    renderMismatch(frames)
    await waitFor(() => expect(decoder.pending).toContain('first.png'))
    decoder.settle('first.png')
    await nextTick()

    frames.value = {
      ...frames.value,
      last: frame('replacement.png', 1280, 720)
    }
    await nextTick()
    decoder.settle('replacement.png')
    await waitFor(() => expect(decoder.decoded).toContain('replacement.png'))
    expect(reported()).toBe('false')

    decoder.settle('slow.png')
    await waitFor(() => expect(decoder.decoded).toContain('slow.png'))
    expect(reported()).toBe('false')
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
