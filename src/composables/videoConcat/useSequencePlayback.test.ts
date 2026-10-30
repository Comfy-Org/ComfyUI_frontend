import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref, shallowRef } from 'vue'

import { useSequencePlayback } from './useSequencePlayback'

function setup(durations = [2, 3, 1.5], playable = durations.map(() => true)) {
  const video = document.createElement('video')
  const videoRef = shallowRef<HTMLVideoElement | null>(video)
  const playback = useSequencePlayback(videoRef, ref(durations), ref(playable))
  return { video, videoRef, ...playback }
}

function finish(video: HTMLVideoElement) {
  Object.defineProperty(video, 'ended', { configurable: true, value: true })
}

describe('useSequencePlayback', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  })

  it('reports the total duration and sequence time', () => {
    const { video, totalDuration, currentTime, seek, handleTimeUpdate } =
      setup()

    seek(2.5)
    video.currentTime = 1.25
    handleTimeUpdate()

    expect(totalDuration.value).toBe(6.5)
    expect(currentTime.value).toBe(3.25)
  })

  it('seeks within the current clip without switching clips', () => {
    const { video, index, seek } = setup()

    seek(1.5)

    expect(index.value).toBe(0)
    expect(video.currentTime).toBe(1.5)
  })

  it('applies a seek into another clip once that clip loads', () => {
    const { video, index, seek, handleLoadedMetadata } = setup()

    seek(5.5)
    expect(index.value).toBe(2)

    handleLoadedMetadata()
    expect(video.currentTime).toBe(0.5)
  })

  it('advances to the next clip and keeps playing', async () => {
    const { index, isPlaying, handleEnded, handleLoadedMetadata } = setup()
    isPlaying.value = true
    await nextTick()

    handleEnded()
    handleLoadedMetadata()

    expect(index.value).toBe(1)
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
  })

  it('stops after the last clip and pauses on request', async () => {
    const { index, isPlaying, seekToClip, handleEnded } = setup()
    seekToClip(2)
    isPlaying.value = true
    await nextTick()

    handleEnded()
    await nextTick()

    expect(index.value).toBe(2)
    expect(isPlaying.value).toBe(false)
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  })

  it('restarts from the first clip when played after the end', async () => {
    const { video, index, isPlaying, seekToClip, handleLoadedMetadata } =
      setup()
    seekToClip(2)
    finish(video)

    isPlaying.value = true
    await nextTick()
    handleLoadedMetadata()

    expect(index.value).toBe(0)
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce()
  })

  it('restarts a single clip in place', async () => {
    const { video, isPlaying } = setup([2])
    video.currentTime = 2
    finish(video)

    isPlaying.value = true
    await nextTick()

    expect(video.currentTime).toBe(0)
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce()
  })

  it('stops playing when the browser refuses to play', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(
      new Error('NotAllowedError')
    )
    const { isPlaying } = setup()

    isPlaying.value = true
    await nextTick()
    await Promise.resolve()

    expect(isPlaying.value).toBe(false)
  })

  it('reset returns to the start, paused', async () => {
    const { index, isPlaying, currentTime, seek, reset } = setup()
    seek(4)
    isPlaying.value = true
    await nextTick()

    reset()

    expect(index.value).toBe(0)
    expect(currentTime.value).toBe(0)
    expect(isPlaying.value).toBe(false)
  })
  it('jumps to a clip whose duration is still unknown', () => {
    const { index, seekToClip } = setup([2, 0, 3])

    seekToClip(1)

    expect(index.value).toBe(1)
  })

  it('restarts the current clip when it is selected again', () => {
    const { video, index, seekToClip } = setup()
    video.currentTime = 1.2

    seekToClip(0)

    expect(index.value).toBe(0)
    expect(video.currentTime).toBe(0)
  })

  it('skips clips that have no video when advancing', () => {
    const { index, handleEnded } = setup([2, 3, 1.5], [true, false, true])

    handleEnded()

    expect(index.value).toBe(2)
  })

  it('stops when no playable clip is left', async () => {
    const { index, isPlaying, handleEnded } = setup(
      [2, 3, 1.5],
      [true, false, false]
    )
    isPlaying.value = true
    await nextTick()

    handleEnded()

    expect(index.value).toBe(0)
    expect(isPlaying.value).toBe(false)
  })

  it('moves past a clip without video when play is pressed on it', async () => {
    const { videoRef, index, isPlaying } = setup([2, 3], [false, true])
    videoRef.value = null

    isPlaying.value = true
    await nextTick()

    expect(index.value).toBe(1)
    expect(isPlaying.value).toBe(true)
  })
  it('moves past a clip without video that is selected during playback', async () => {
    const { index, isPlaying, seekToClip } = setup(
      [2, 3, 1.5],
      [true, false, true]
    )
    isPlaying.value = true
    await nextTick()

    seekToClip(1)

    expect(index.value).toBe(2)
    expect(isPlaying.value).toBe(true)
  })

  it('moves past a clip without video that a seek lands in during playback', async () => {
    const { index, isPlaying, seek } = setup([2, 3, 1.5], [true, false, true])
    isPlaying.value = true
    await nextTick()

    seek(3)

    expect(index.value).toBe(2)
  })

  it('selects a clip without video while stopped', () => {
    const { index, isPlaying, seekToClip } = setup(
      [2, 3, 1.5],
      [true, false, true]
    )

    seekToClip(1)

    expect(index.value).toBe(1)
    expect(isPlaying.value).toBe(false)
  })
})
