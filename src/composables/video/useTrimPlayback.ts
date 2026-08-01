import { ref, watch } from 'vue'
import type { Ref } from 'vue'

import { clamp } from 'es-toolkit'

const SEEK_EVENT_TIMEOUT_MS = 5000

interface UseTrimPlaybackOptions {
  videoRef: Ref<HTMLVideoElement | null>
  frameMax: Ref<number>
  startFrame: Ref<number>
  endFrame: Ref<number>
  playheadFrame: Ref<number>
  hasTrimTimeline: Ref<boolean>
  frameToTime: (frame: number) => number
  timeToFrame: (time: number) => number
}

export function useTrimPlayback(options: UseTrimPlaybackOptions) {
  const {
    videoRef,
    frameMax,
    startFrame,
    endFrame,
    playheadFrame,
    hasTrimTimeline,
    frameToTime,
    timeToFrame
  } = options

  const isPlaying = ref(false)
  const isSeeking = ref(false)
  let activeSeekId = 0

  function clampSeekTime(video: HTMLVideoElement, time: number) {
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      return Math.max(time, 0)
    }
    return clamp(time, 0, Math.max(video.duration - 0.001, 0))
  }

  function waitForVideoSeek(video: HTMLVideoElement): Promise<void> {
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer)
        video.removeEventListener('seeked', finish)
        video.removeEventListener('error', finish)
        resolve()
      }
      const timer = setTimeout(finish, SEEK_EVENT_TIMEOUT_MS)
      video.addEventListener('seeked', finish, { once: true })
      video.addEventListener('error', finish, { once: true })
    })
  }

  async function seekPreviewToFrame(frame: number) {
    const video = videoRef.value
    if (!video) return

    const clamped = clamp(frame, 0, frameMax.value)
    playheadFrame.value = clamped

    const targetTime = clampSeekTime(video, frameToTime(clamped))
    if (Math.abs(video.currentTime - targetTime) <= 0.0001) return

    const seekId = ++activeSeekId
    isSeeking.value = true
    video.currentTime = targetTime
    await waitForVideoSeek(video)

    if (seekId === activeSeekId) {
      isSeeking.value = false
    }
  }

  async function handlePlaybackChange(playing: boolean) {
    const video = videoRef.value
    if (!video) return
    if (playing) {
      const startAt =
        playheadFrame.value >= endFrame.value
          ? startFrame.value
          : clamp(playheadFrame.value, startFrame.value, endFrame.value)
      await seekPreviewToFrame(startAt)
      if (!isPlaying.value) return
      try {
        await video.play()
      } catch {
        isPlaying.value = false
      }
    } else {
      video.pause()
    }
  }

  function resolvePlayheadTrimCollision() {
    const start = startFrame.value
    const end = endFrame.value
    const previous = playheadFrame.value
    if (previous < start) {
      playheadFrame.value = start
    } else if (previous > end) {
      playheadFrame.value = end
    }
    if (playheadFrame.value !== previous) {
      void seekPreviewToFrame(playheadFrame.value)
    }
  }

  function handleScrub(frame: number) {
    isPlaying.value = false
    void seekPreviewToFrame(frame)
  }

  function handleTimeUpdate() {
    const video = videoRef.value
    if (!video || !hasTrimTimeline.value || !isPlaying.value || isSeeking.value)
      return

    const frame = timeToFrame(video.currentTime)
    playheadFrame.value = clamp(frame, startFrame.value, endFrame.value)

    if (frame >= endFrame.value) {
      isPlaying.value = false
      void seekPreviewToFrame(endFrame.value)
    }
  }

  watch(isPlaying, (playing) => {
    void handlePlaybackChange(playing)
  })

  watch([startFrame, endFrame], resolvePlayheadTrimCollision)

  return { isPlaying, seekPreviewToFrame, handleScrub, handleTimeUpdate }
}
