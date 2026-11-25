import { sum } from 'es-toolkit'
import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'

import {
  locateSequenceTime,
  sequenceStarts
} from '@/composables/videoConcat/videoSequence'

export function useSequencePlayback(
  videoRef: Readonly<Ref<HTMLVideoElement | null>>,
  durations: Readonly<Ref<number[]>>,
  playable: Readonly<Ref<boolean[]>>
) {
  const index = ref(0)
  const clipTime = ref(0)
  const isPlaying = ref(false)
  let pendingOffset: number | undefined

  const starts = computed(() => sequenceStarts(durations.value))
  const totalDuration = computed(() => sum(durations.value))
  const currentTime = computed(
    () => (starts.value[index.value] ?? 0) + clipTime.value
  )

  function startVideo(video: HTMLVideoElement) {
    video.play().catch(() => {
      isPlaying.value = false
    })
  }

  function selectClip(clipIndex: number, offset = 0) {
    clipTime.value = offset
    if (clipIndex !== index.value) {
      index.value = clipIndex
      pendingOffset = offset
      if (isPlaying.value && !playable.value[clipIndex]) advance()
      return
    }
    if (videoRef.value) videoRef.value.currentTime = offset
  }

  function seek(time: number) {
    const target = locateSequenceTime(durations.value, time)
    selectClip(target.index, target.offset)
  }

  function seekToClip(clipIndex: number) {
    selectClip(clipIndex)
  }

  function playableIndexAfter(clipIndex: number): number | undefined {
    const next = playable.value.findIndex(
      (canPlay, candidate) => canPlay && candidate > clipIndex
    )
    return next === -1 ? undefined : next
  }

  function advance() {
    const next = playableIndexAfter(index.value)
    if (next === undefined) {
      isPlaying.value = false
      return
    }
    selectClip(next)
  }

  function reset() {
    isPlaying.value = false
    index.value = 0
    clipTime.value = 0
    pendingOffset = 0
  }

  function handleLoadedMetadata() {
    const video = videoRef.value
    if (!video) return
    if (pendingOffset !== undefined) {
      video.currentTime = pendingOffset
      pendingOffset = undefined
    }
    if (isPlaying.value) startVideo(video)
  }

  function handleTimeUpdate() {
    const video = videoRef.value
    if (video) clipTime.value = video.currentTime
  }

  watch(isPlaying, (playing) => {
    const video = videoRef.value
    if (!video) {
      if (playing) advance()
      return
    }
    if (!playing) {
      video.pause()
      return
    }
    if (video.ended && playableIndexAfter(index.value) === undefined) {
      const first = playableIndexAfter(-1) ?? 0
      const restartsInPlace = first === index.value
      selectClip(first)
      if (!restartsInPlace) return
    }
    startVideo(video)
  })

  return {
    index,
    isPlaying,
    currentTime,
    totalDuration,
    seek,
    seekToClip,
    reset,
    handleLoadedMetadata,
    handleTimeUpdate,
    handleEnded: advance
  }
}
