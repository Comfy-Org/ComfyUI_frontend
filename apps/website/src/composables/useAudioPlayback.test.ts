import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { clock, useAudioPlayback } from './useAudioPlayback'

function element(overrides: Partial<HTMLAudioElement> = {}) {
  return {
    paused: true,
    currentTime: 0,
    duration: 60,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    ...overrides
  } as unknown as HTMLAudioElement
}

// A click on a 100px-wide line starting at x = 0, unless said otherwise.
function clickAt(x: number, width = 100) {
  const line = document.createElement('div')
  line.getBoundingClientRect = () => ({ left: 0, width }) as unknown as DOMRect
  const event = new MouseEvent('click', { clientX: x })
  Object.defineProperty(event, 'currentTarget', { value: line })
  return event
}

function mounted(overrides?: Partial<HTMLAudioElement>) {
  const source = ref<string | undefined>('blob:one')
  const player = useAudioPlayback(source)
  player.audio.value = element(overrides)
  player.readDuration()
  return { source, player }
}

describe('clock', () => {
  it.for([
    { seconds: 0, reads: '0:00' },
    { seconds: 9.7, reads: '0:09' },
    { seconds: 65, reads: '1:05' },
    { seconds: 600, reads: '10:00' },
    { seconds: Number.NaN, reads: '0:00' },
    { seconds: Number.POSITIVE_INFINITY, reads: '0:00' }
  ])('writes $seconds as $reads', ({ seconds, reads }) => {
    expect(clock(seconds)).toBe(reads)
  })
})

describe('useAudioPlayback', () => {
  it('measures how far through the recording it is', () => {
    const { player } = mounted()
    expect(player.seekable.value).toBe(true)
    expect(player.progress.value).toBe(0)

    player.elapsed.value = 15
    expect(player.progress.value).toBe(25)
  })

  // A live recording, and some containers, report no length at all. A fraction
  // of that is not a number, and seeking to it throws.
  it.for([
    { length: Number.POSITIVE_INFINITY, named: 'an endless stream' },
    { length: Number.NaN, named: 'a length not yet known' },
    { length: 0, named: 'an empty recording' }
  ])('does not seek within $named', ({ length }) => {
    const { player } = mounted({ duration: length })

    expect(player.seekable.value).toBe(false)
    expect(player.progress.value).toBe(0)

    player.seekTo(10)
    expect(player.audio.value?.currentTime).toBe(0)
  })

  it('keeps a seek inside the recording', () => {
    const { player } = mounted()

    player.seekTo(-10)
    expect(player.audio.value?.currentTime).toBe(0)

    player.seekTo(90)
    expect(player.audio.value?.currentTime).toBe(60)

    player.seekTo(30)
    expect(player.audio.value?.currentTime).toBe(30)
  })

  // The line is the whole width of the recording, so where the pointer lands
  // along it is where the recording is taken up.
  it.for([
    { at: 0, lands: 0 },
    { at: 50, lands: 30 },
    { at: 100, lands: 60 },
    { at: -20, lands: 0 },
    { at: 140, lands: 60 }
  ])('a click $at px along a 100px line lands at $lands', ({ at, lands }) => {
    const { player } = mounted()

    player.seekToPoint(clickAt(at))

    expect(player.audio.value?.currentTime).toBe(lands)
  })

  // A line the browser has not laid out yet has no length to be a fraction of.
  it('does not seek on a line with no width', () => {
    const { player } = mounted()

    player.seekToPoint(clickAt(40, 0))

    expect(player.audio.value?.currentTime).toBe(0)
  })

  it('leaves a click that did not land on an element alone', () => {
    const { player } = mounted()

    player.seekToPoint(new MouseEvent('click'))

    expect(player.audio.value?.currentTime).toBe(0)
  })

  // Each press moves on from the last, even before the element reports back.
  it('compounds repeated presses', () => {
    const { player } = mounted()

    for (const _ of [1, 2, 3])
      player.seekByKey(new KeyboardEvent('keydown', { key: 'ArrowRight' }))

    expect(player.audio.value?.currentTime).toBe(15)
  })

  it('leaves the keys to the page when there is nothing to seek within', () => {
    const { player } = mounted({ duration: Number.POSITIVE_INFINITY })
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      cancelable: true
    })

    player.seekByKey(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it.for([
    { key: 'ArrowRight', from: 10, lands: 15 },
    { key: 'ArrowLeft', from: 10, lands: 5 },
    { key: 'ArrowLeft', from: 2, lands: 0 },
    { key: 'Home', from: 30, lands: 0 },
    { key: 'End', from: 30, lands: 60 }
  ])('$key from $from lands at $lands', ({ key, from, lands }) => {
    const { player } = mounted()
    player.elapsed.value = from
    const event = new KeyboardEvent('keydown', { key, cancelable: true })

    player.seekByKey(event)

    expect(player.audio.value?.currentTime).toBe(lands)
    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves a key it does not answer to the page', () => {
    const { player } = mounted()
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })

    player.seekByKey(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it('plays what is paused and pauses what is playing', () => {
    const { player } = mounted()
    player.toggle()
    expect(player.audio.value?.play).toHaveBeenCalledOnce()

    player.audio.value = element({ paused: false })
    player.toggle()
    expect(player.audio.value.pause).toHaveBeenCalledOnce()
    expect(player.audio.value.play).not.toHaveBeenCalled()
  })

  // A browser may refuse the first play outright, and an unhandled refusal
  // would leave the button showing a pause it never reached.
  it('shows nothing playing when the browser refuses', async () => {
    const { player } = mounted({
      play: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError'))
    })
    player.playing.value = true

    player.toggle()
    await nextTick()

    expect(player.playing.value).toBe(false)
  })

  it('starts a different recording from the beginning', async () => {
    const { source, player } = mounted()
    player.playing.value = true
    player.elapsed.value = 30

    source.value = 'blob:two'
    await nextTick()

    expect(player.playing.value).toBe(false)
    expect(player.elapsed.value).toBe(0)
    expect(player.duration.value).toBe(0)
  })
})
