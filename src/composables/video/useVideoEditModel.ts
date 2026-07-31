import { computed, ref, watch } from 'vue'
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

  const trimSection = computed(
    () => modelValue.value.trim ?? { start_time: 0, duration: 0 }
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
      const crop = modelValue.value.crop
      if (!crop || crop.width <= 0 || crop.height <= 0) {
        return { x: 0, y: 0, width: width.value, height: height.value }
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

  const hasActiveTrim = () => {
    const trim = modelValue.value.trim
    return !!trim && (trim.start_time > 0 || trim.duration > 0)
  }

  const hasActiveCrop = () => {
    const crop = modelValue.value.crop
    return !!crop && crop.width > 0 && crop.height > 0
  }

  const trimEnabledState = ref(hasActiveTrim())
  const cropEnabledState = ref(hasActiveCrop())

  const trimEnabled = computed({
    get: () => trimEnabledState.value,
    set: (enabled) => {
      trimEnabledState.value = enabled
      if (!enabled) setTrim({ start_time: 0, duration: 0 })
    }
  })

  const cropEnabled = computed({
    get: () => cropEnabledState.value,
    set: (enabled) => {
      cropEnabledState.value = enabled
      if (!enabled) {
        modelValue.value = {
          ...modelValue.value,
          crop: { x: 0, y: 0, width: 0, height: 0 }
        }
      }
    }
  })

  watch(hasActiveTrim, (active) => {
    if (active) trimEnabledState.value = true
  })
  watch(hasActiveCrop, (active) => {
    if (active) cropEnabledState.value = true
  })

  return { startFrame, endFrame, cropBounds, trimEnabled, cropEnabled }
}
