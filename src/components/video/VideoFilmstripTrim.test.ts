/* eslint-disable testing-library/prefer-user-event -- pointer capture scrubbing needs low-level pointer events */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue';
import type { Ref } from 'vue';

const { activeHandle } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref: createRef } = require('vue')
  return {
    activeHandle: createRef(null) as Ref<'min' | 'max' | 'midpoint' | null>
  }
})

vi.mock('@/composables/useRangeEditor', () => ({
  useRangeEditor: () => ({
    startDrag: vi.fn(),
    activeHandle
  })
}))

import type { ComponentProps } from 'vue-component-type-helpers'
import { fireEvent, render, screen } from '@testing-library/vue'
import { createI18n } from 'vue-i18n'

import VideoFilmstripTrim from './VideoFilmstripTrim.vue'
import { timelineInsetLeftStyle } from './timelineInsetStyle'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      loadVideoTrim: {
        play: 'Play',
        pause: 'Pause',
        loadingFilmstrip: 'Loading filmstrip…',
        adjustStartFrame: 'Adjust start frame',
        adjustEndFrame: 'Adjust end frame'
      }
    }
  }
})

type FilmstripProps = ComponentProps<typeof VideoFilmstripTrim>

function expectedFrameAt(clientX: number, width = 200, frameMax = 100) {
  const contentWidth = Math.max(width - 32, 1)
  const norm = Math.min(Math.max((clientX - 16) / contentWidth, 0), 1)
  return Math.round(norm * frameMax)
}

function renderFilmstrip(props: FilmstripProps) {
  return render(VideoFilmstripTrim, {
    props,
    global: {
      plugins: [i18n]
    }
  })
}

function mockTrackRect() {
  const track = screen.getByTestId('trim-track')
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 200,
    height: 64,
    right: 200,
    bottom: 64,
    x: 0,
    y: 0,
    toJSON: () => ({})
  })
  return track
}

describe('VideoFilmstripTrim', () => {
  beforeEach(() => {
    activeHandle.value = null
  })

  it('insets the filmstrip track by handle width on each side', () => {
    renderFilmstrip({
      totalFrames: 100,
      thumbnails: ['data:image/jpeg;base64,one'],
      startFrame: 0,
      endFrame: 99,
      playheadFrame: 0,
      disabled: false
    })

    const filmstrip = screen.getByTestId('filmstrip-track')
    expect(filmstrip.style.left).toBe('16px')
    expect(filmstrip.style.right).toBe('16px')
  })

  it('prevents filmstrip thumbnails from being dragged', () => {
    renderFilmstrip({
      totalFrames: 100,
      thumbnails: ['data:image/jpeg;base64,one'],
      startFrame: 0,
      endFrame: 99,
      playheadFrame: 0,
      disabled: false
    })

    expect(
      screen.getByTestId('filmstrip-thumbnail').getAttribute('draggable')
    ).toBe('false')
  })

  it('shows whole frame number in tooltip while dragging end handle', () => {
    activeHandle.value = 'max'
    renderFilmstrip({
      totalFrames: 401,
      thumbnails: ['data:image/jpeg;base64,one'],
      startFrame: 0,
      endFrame: 400,
      playheadFrame: 0,
      disabled: false
    })

    expect(screen.getByTestId('trim-handle-tooltip')).toHaveTextContent('400')
    expect(timelineInsetLeftStyle(1).left).toBe(
      'calc(1 * (100% - 2rem) + 1rem)'
    )
  })

  it('shows whole frame number in tooltip while dragging start handle', () => {
    activeHandle.value = 'min'
    renderFilmstrip({
      totalFrames: 401,
      thumbnails: ['data:image/jpeg;base64,one'],
      startFrame: 120,
      endFrame: 400,
      playheadFrame: 120,
      disabled: false
    })

    expect(screen.getByTestId('trim-handle-tooltip')).toHaveTextContent('120')
    expect(timelineInsetLeftStyle(120 / 400).left).toBe(
      'calc(0.3 * (100% - 2rem) + 1rem)'
    )
  })

  it('positions the playhead on the timeline', () => {
    renderFilmstrip({
      totalFrames: 101,
      thumbnails: ['data:image/jpeg;base64,one'],
      startFrame: 0,
      endFrame: 100,
      playheadFrame: 50,
      disabled: false
    })

    expect(screen.getByTestId('playhead')).toBeTruthy()
    expect(timelineInsetLeftStyle(50 / 100).left).toBe(
      'calc(0.5 * (100% - 2rem) + 1rem)'
    )
  })

  it('scrubs to the clicked frame on the filmstrip', async () => {
    const playheadFrame = ref(0)
    const { emitted } = render(VideoFilmstripTrim, {
      props: {
        totalFrames: 101,
        thumbnails: ['data:image/jpeg;base64,one'],
        startFrame: 0,
        endFrame: 100,
        playheadFrame: 0,
        disabled: false,
        'onUpdate:playheadFrame': (value: number) => {
          playheadFrame.value = value
        }
      },
      global: {
        plugins: [i18n]
      }
    })

    const track = mockTrackRect()

    await fireEvent.pointerDown(track, { clientX: 100, button: 0 })

    expect(playheadFrame.value).toBe(expectedFrameAt(100))
    expect(emitted().scrub).toEqual([[expectedFrameAt(100)]])
  })

  it('scrubs to frames outside the trim selection', async () => {
    const playheadFrame = ref(50)
    const { emitted } = render(VideoFilmstripTrim, {
      props: {
        totalFrames: 101,
        thumbnails: ['data:image/jpeg;base64,one'],
        startFrame: 10,
        endFrame: 80,
        playheadFrame: 50,
        disabled: false,
        'onUpdate:playheadFrame': (value: number) => {
          playheadFrame.value = value
        }
      },
      global: {
        plugins: [i18n]
      }
    })

    const track = mockTrackRect()

    await fireEvent.pointerDown(track, { clientX: 20, button: 0 })

    expect(playheadFrame.value).toBe(expectedFrameAt(20))
    expect(emitted().scrub).toEqual([[expectedFrameAt(20)]])
  })

  it('updates playhead while dragging across the filmstrip', async () => {
    const playheadFrame = ref(0)
    const { emitted } = render(VideoFilmstripTrim, {
      props: {
        totalFrames: 101,
        thumbnails: ['data:image/jpeg;base64,one'],
        startFrame: 0,
        endFrame: 100,
        playheadFrame: 0,
        disabled: false,
        'onUpdate:playheadFrame': (value: number) => {
          playheadFrame.value = value
        }
      },
      global: {
        plugins: [i18n]
      }
    })

    const track = mockTrackRect()
    track.setPointerCapture = vi.fn()

    await fireEvent.pointerDown(track, { clientX: 40, button: 0, pointerId: 1 })
    await fireEvent.pointerMove(track, {
      clientX: 120,
      button: 0,
      pointerId: 1
    })

    expect(playheadFrame.value).toBe(expectedFrameAt(120))
    expect(emitted().scrub).toEqual([
      [expectedFrameAt(40)],
      [expectedFrameAt(120)]
    ])
  })

  it('shows the frame number in a tooltip while scrubbing', async () => {
    const playheadFrame = ref(0)
    render(VideoFilmstripTrim, {
      props: {
        totalFrames: 101,
        thumbnails: ['data:image/jpeg;base64,one'],
        startFrame: 0,
        endFrame: 100,
        playheadFrame: 0,
        disabled: false,
        'onUpdate:playheadFrame': (value: number) => {
          playheadFrame.value = value
        }
      },
      global: {
        plugins: [i18n]
      }
    })

    const track = mockTrackRect()
    track.setPointerCapture = vi.fn()

    expect(screen.queryByTestId('scrub-tooltip')).toBeNull()

    await fireEvent.pointerDown(track, {
      clientX: 120,
      button: 0,
      pointerId: 1
    })

    expect(screen.getByTestId('scrub-tooltip')).toHaveTextContent(
      String(expectedFrameAt(120))
    )

    await fireEvent.pointerUp(track, { pointerId: 1 })

    expect(screen.queryByTestId('scrub-tooltip')).toBeNull()
  })

  it('renders trim handles when enabled', () => {
    renderFilmstrip({
      totalFrames: 100,
      thumbnails: ['data:image/jpeg;base64,one'],
      startFrame: 10,
      endFrame: 80,
      playheadFrame: 10,
      disabled: false
    })

    expect(screen.getByTestId('handle-start')).toBeTruthy()
    expect(screen.getByTestId('handle-end')).toBeTruthy()
  })

  it('hides trim handles when disabled', () => {
    renderFilmstrip({
      totalFrames: 100,
      thumbnails: ['data:image/jpeg;base64,one'],
      startFrame: 10,
      endFrame: 80,
      playheadFrame: 10,
      disabled: true
    })

    expect(screen.queryByTestId('handle-start')).toBeNull()
    expect(screen.queryByTestId('handle-end')).toBeNull()
  })

  it('hides trim selection UI when trim is toggled off', () => {
    renderFilmstrip({
      totalFrames: 100,
      thumbnails: ['data:image/jpeg;base64,one'],
      startFrame: 10,
      endFrame: 80,
      playheadFrame: 10,
      trimEnabled: false
    })

    expect(screen.getByTestId('playhead')).toBeTruthy()
    expect(screen.getByTestId('filmstrip-track').style.left).toBe('16px')
    expect(screen.getByTestId('filmstrip-track').style.right).toBe('16px')
    expect(screen.queryByTestId('handle-start')).toBeNull()
    expect(screen.queryByTestId('handle-end')).toBeNull()
  })

  it('scrubs across the full timeline when trim is toggled off', async () => {
    const playheadFrame = ref(0)
    const { emitted } = render(VideoFilmstripTrim, {
      props: {
        totalFrames: 101,
        thumbnails: ['data:image/jpeg;base64,one'],
        startFrame: 10,
        endFrame: 80,
        playheadFrame: 0,
        trimEnabled: false,
        'onUpdate:playheadFrame': (value: number) => {
          playheadFrame.value = value
        }
      },
      global: {
        plugins: [i18n]
      }
    })

    const track = mockTrackRect()

    await fireEvent.pointerDown(track, { clientX: 100, button: 0 })

    expect(playheadFrame.value).toBe(expectedFrameAt(100))
    expect(emitted().scrub).toEqual([[expectedFrameAt(100)]])
  })
})
