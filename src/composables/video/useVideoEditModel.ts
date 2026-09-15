import { computed, watch } from 'vue'
import type { Ref } from 'vue'

import { clamp } from 'es-toolkit'

import type {
  VideoEditTrim,
  VideoEditValue
} from '@/lib/litegraph/src/types/widgets'
import type { Bounds } from '@/renderer/core/layout/types'
import { frameToTime, roundSeconds, timeToFrame } from '@/utils/videoFrameUtil'

interface UseVideoEditModelOptions {
  duration: Ref<number>
  totalFrames: Ref<number>
  fps: Ref<number>
  width: Ref<number>
  height: Ref<number>
}

function finiteOrZero(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function sanitizeTrim(
  trim: VideoEditTrim | undefined
): VideoEditTrim | undefined {
  if (!trim) return undefined
  const startTime = Math.max(finiteOrZero(trim.start_time), 0)
  const trimDuration = Math.max(finiteOrZero(trim.duration), 0)
  return trim.start_time === startTime && trim.duration === trimDuration
    ? trim
    : { start_time: startTime, duration: trimDuration }
}

function sanitizeCrop(crop: Bounds | undefined): Bounds | undefined {
  if (!crop) return undefined
  const usable =
    [crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) &&
    crop.x >= 0 &&
    crop.y >= 0 &&
    crop.width > 0 &&
    crop.height > 0
  if (usable) return crop
  const isNoOp =
    crop.x === 0 && crop.y === 0 && crop.width === 0 && crop.height === 0
  return isNoOp ? crop : { x: 0, y: 0, width: 0, height: 0 }
}

export function useVideoEditModel(
  modelValue: Ref<VideoEditValue>,
  options: UseVideoEditModelOptions
) {
  const { duration, totalFrames, fps, width, height } = options

  const frameMax = computed(() => Math.max(totalFrames.value - 1, 0))

  const toTime = (frame: number) =>
    frameToTime(frame, duration.value, totalFrames.value, fps.value)
  const toFrame = (time: number) =>
    timeToFrame(time, duration.value, totalFrames.value, fps.value)

  watch(
    modelValue,
    (value) => {
      const trim = sanitizeTrim(value.trim)
      const crop = sanitizeCrop(value.crop)
      if (trim !== value.trim || crop !== value.crop) {
        modelValue.value = {
          ...value,
          ...(trim && { trim }),
          ...(crop && { crop })
        }
      }
    },
    { immediate: true }
  )

  const trimSection = computed(
    () => sanitizeTrim(modelValue.value.trim) ?? { start_time: 0, duration: 0 }
  )

  const trimsToVideoEnd = computed(() => trimSection.value.duration === 0)

  const endTimeSeconds = computed(() =>
    trimsToVideoEnd.value
      ? duration.value
      : trimSection.value.start_time + trimSection.value.duration
  )

  function setTrim(trim: VideoEditTrim) {
    modelValue.value = { ...modelValue.value, trim }
  }

  const currentEndFrame = () =>
    trimsToVideoEnd.value
      ? frameMax.value
      : clamp(toFrame(endTimeSeconds.value) - 1, 0, frameMax.value)

  const startFrame = computed({
    get: () => clamp(toFrame(trimSection.value.start_time), 0, frameMax.value),
    set: (frame) => {
      const maxStart = Math.max(currentEndFrame() - 1, 0)
      const startTime = roundSeconds(toTime(clamp(frame, 0, maxStart)))
      setTrim({
        start_time: startTime,
        duration: trimsToVideoEnd.value
          ? 0
          : roundSeconds(Math.max(endTimeSeconds.value - startTime, 0))
      })
    }
  })

  const endFrame = computed({
    get: () => currentEndFrame(),
    set: (frame) => {
      const minEnd = clamp(
        toFrame(trimSection.value.start_time) + 1,
        0,
        frameMax.value
      )
      const clamped = clamp(frame, minEnd, frameMax.value)
      setTrim({
        start_time: trimSection.value.start_time,
        duration:
          clamped >= frameMax.value
            ? 0
            : roundSeconds(
                Math.max(toTime(clamped + 1) - trimSection.value.start_time, 0)
              )
      })
    }
  })

  const cropBounds = computed<Bounds>({
    get: () => {
      const crop = sanitizeCrop(modelValue.value.crop)
      if (!crop || crop.width <= 0 || crop.height <= 0) {
        return { x: 0, y: 0, width: width.value, height: height.value }
      }
      if (width.value > 0 && height.value > 0) {
        const x = Math.min(crop.x, width.value - 1)
        const y = Math.min(crop.y, height.value - 1)
        return {
          x,
          y,
          width: Math.min(crop.width, width.value - x),
          height: Math.min(crop.height, height.value - y)
        }
      }
      return { ...crop }
    },
    set: (next) => {
      const coversFullFrame =
        next.x <= 0 &&
        next.y <= 0 &&
        next.width >= width.value &&
        next.height >= height.value
      if (coversFullFrame) {
        modelValue.value = {
          ...modelValue.value,
          crop: { x: 0, y: 0, width: 0, height: 0 }
        }
        return
      }
      const x = clamp(Math.round(next.x), 0, width.value)
      const y = clamp(Math.round(next.y), 0, height.value)
      modelValue.value = {
        ...modelValue.value,
        crop: {
          x,
          y,
          width: clamp(Math.round(next.width), 0, width.value - x),
          height: clamp(Math.round(next.height), 0, height.value - y)
        }
      }
    }
  })

  return { startFrame, endFrame, cropBounds }
}
