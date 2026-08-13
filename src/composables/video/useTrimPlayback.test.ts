import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { EffectScope, Ref } from 'vue'

import { useTrimPlayback } from './useTrimPlayback'

type Listener = (event: Event) => void

class MockVideoElement {
  duration = 10
  paused = true
  emitSeeked = true
  private _currentTime = 0
  play = vi.fn(async () => {
    this.paused = false
  })
  pause = vi.fn(() => {
    this.paused = true
  })
  private listeners = new Map<string, Set<Listener>>()

  get currentTime() {
    return this._currentTime
  }

  set currentTime(value: number) {
    this._currentTime = value
    if (this.emitSeeked) {
      queueMicrotask(() => this.emit('seeked'))
    }
  }

  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(listener)
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener)
  }

  emit(type: string) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener(new Event(type))
    }
  }
}

async function flushSeek() {
  await new Promise((resolve) => setTimeout(resolve))
}

describe('useTrimPlayback', () => {
  let scope: EffectScope | undefined

  afterEach(() => {
    scope?.stop()
    scope = undefined
  })

  function createPlayback({
    frameToTime = (frame: number) => frame / 10,
    frameMax = 100
  } = {}) {
    const video = new MockVideoElement()
    const startFrame = ref(0)
    const endFrame = ref(100)
    const playheadFrame = ref(0)

    scope = effectScope()
    const playback = scope.run(() =>
      useTrimPlayback({
        videoRef: ref(video) as unknown as Ref<HTMLVideoElement | null>,
        frameMax: ref(frameMax),
        startFrame,
        endFrame,
        playheadFrame,
        frameToTime,
        timeToFrame: (time) => Math.round(time * 10)
      })
    )!

    return { video, startFrame, endFrame, playheadFrame, ...playback }
  }

  it('seeks the video and stops playback on scrub', async () => {
    const { video, playheadFrame, isPlaying, handleScrub } = createPlayback()
    isPlaying.value = true

    handleScrub(50)
    await flushSeek()

    expect(isPlaying.value).toBe(false)
    expect(playheadFrame.value).toBe(50)
    expect(video.currentTime).toBe(5)
  })

  it('plays from the current playhead within the trim window', async () => {
    const { video, playheadFrame, isPlaying } = createPlayback()
    playheadFrame.value = 30

    isPlaying.value = true
    await flushSeek()

    expect(video.currentTime).toBe(3)
    expect(video.play).toHaveBeenCalled()
  })

  it('restarts from the start frame when the playhead reached the end', async () => {
    const { video, startFrame, endFrame, playheadFrame, isPlaying } =
      createPlayback()
    startFrame.value = 20
    endFrame.value = 80
    await nextTick()
    playheadFrame.value = 80

    isPlaying.value = true
    await flushSeek()

    expect(playheadFrame.value).toBe(20)
    expect(video.currentTime).toBe(2)
  })

  it('ignores seeks to a non-finite frame', async () => {
    const { video, isPlaying, playheadFrame } = createPlayback()
    video.currentTime = 4
    await flushSeek()
    playheadFrame.value = Number.NaN

    isPlaying.value = true
    await flushSeek()

    expect(video.currentTime).toBe(4)
    expect(video.play).toHaveBeenCalled()
  })

  it.for([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'skips seeking when the frame maps to the non-finite time %s',
    async (mappedTime) => {
      const { video, isPlaying } = createPlayback({
        frameToTime: () => mappedTime
      })
      video.currentTime = 4
      await flushSeek()

      isPlaying.value = true
      await flushSeek()

      expect(video.currentTime).toBe(4)
      expect(video.paused).toBe(false)
    }
  )

  it('leaves the playhead untouched when the frame maps to a non-finite time', async () => {
    const { video, playheadFrame, handleScrub } = createPlayback({
      frameToTime: () => Number.NaN
    })
    video.currentTime = 4
    await flushSeek()
    playheadFrame.value = 30

    handleScrub(50)
    await flushSeek()

    expect(playheadFrame.value).toBe(30)
    expect(video.currentTime).toBe(4)
  })

  it('stops playing when the video refuses to play', async () => {
    const { video, isPlaying } = createPlayback()
    video.play.mockRejectedValueOnce(new Error('autoplay blocked'))

    isPlaying.value = true
    await flushSeek()

    expect(isPlaying.value).toBe(false)
  })

  it('re-seeks the video when a trim handle passes the playhead during playback', async () => {
    const { video, startFrame, playheadFrame, isPlaying } = createPlayback()
    playheadFrame.value = 10

    isPlaying.value = true
    await flushSeek()
    expect(video.currentTime).toBe(1)

    startFrame.value = 30
    await nextTick()
    await flushSeek()

    expect(isPlaying.value).toBe(true)
    expect(playheadFrame.value).toBe(30)
    expect(video.currentTime).toBe(3)
  })

  it('pauses the video when playback stops', async () => {
    const { video, isPlaying } = createPlayback()
    isPlaying.value = true
    await flushSeek()

    isPlaying.value = false
    await nextTick()

    expect(video.pause).toHaveBeenCalled()
  })

  it('syncs the playhead on timeupdate and stops at the trim end', async () => {
    const { video, endFrame, playheadFrame, isPlaying, handleTimeUpdate } =
      createPlayback()
    endFrame.value = 60
    await nextTick()
    isPlaying.value = true
    await flushSeek()

    video.currentTime = 4
    handleTimeUpdate()
    expect(playheadFrame.value).toBe(40)
    expect(isPlaying.value).toBe(true)

    video.currentTime = 6.2
    handleTimeUpdate()
    expect(playheadFrame.value).toBe(60)
    expect(isPlaying.value).toBe(false)
  })

  it('keeps playing through timeupdates when the video has no frame model', async () => {
    const { video, endFrame, isPlaying, handleTimeUpdate } = createPlayback({
      frameMax: 0
    })
    endFrame.value = 0
    await nextTick()

    isPlaying.value = true
    await flushSeek()

    video.currentTime = 0.5
    handleTimeUpdate()

    expect(isPlaying.value).toBe(true)
  })

  it('releases the seek lock when no seeked event ever arrives', async () => {
    const { video, playheadFrame, isPlaying, handleTimeUpdate } =
      createPlayback()
    video.emitSeeked = false
    playheadFrame.value = 30

    isPlaying.value = true
    await nextTick()

    video.currentTime = 4
    handleTimeUpdate()
    expect(playheadFrame.value).toBe(30)

    await vi.advanceTimersByTimeAsync(5000)

    video.currentTime = 4.5
    handleTimeUpdate()
    expect(playheadFrame.value).toBe(45)
  })

  it('clamps the playhead when the trim handles move past it', async () => {
    const { startFrame, playheadFrame } = createPlayback()
    playheadFrame.value = 10

    startFrame.value = 30
    await nextTick()
    await flushSeek()

    expect(playheadFrame.value).toBe(30)
  })
})
