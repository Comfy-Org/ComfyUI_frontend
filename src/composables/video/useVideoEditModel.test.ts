import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { EffectScope } from 'vue'

import type { VideoEditValue } from '@/lib/litegraph/src/types/widgets'

import { useVideoEditModel } from './useVideoEditModel'

describe('useVideoEditModel', () => {
  let scope: EffectScope | undefined

  afterEach(() => {
    scope?.stop()
    scope = undefined
  })

  function createModel(
    initial: VideoEditValue = {},
    { duration = 10, fps = 10 } = {}
  ) {
    const modelValue = ref<VideoEditValue>(initial)
    scope = effectScope()
    const model = scope.run(() =>
      useVideoEditModel(modelValue, {
        duration: ref(duration),
        totalFrames: ref(100),
        fps: ref(fps),
        width: ref(1920),
        height: ref(1080)
      })
    )!
    return { modelValue, ...model }
  }

  describe('trim frames', () => {
    it('spans the full range for the default no-op value', () => {
      const { startFrame, endFrame } = createModel()

      expect(startFrame.value).toBe(0)
      expect(endFrame.value).toBe(99)
    })

    it('serializes boundaries that cover the selected frames exactly', () => {
      const { modelValue, startFrame, endFrame } = createModel()

      startFrame.value = 10
      endFrame.value = 80

      expect(modelValue.value.trim).toEqual({ start_time: 1, duration: 7.1 })
      expect(startFrame.value).toBe(10)
      expect(endFrame.value).toBe(80)
    })

    it('writes start_time in seconds and keeps trimming to the end', () => {
      const { modelValue, startFrame } = createModel()

      startFrame.value = 10

      expect(modelValue.value.trim).toEqual({ start_time: 1, duration: 0 })
    })

    it('writes an explicit duration when the end handle moves off the last frame', () => {
      const { modelValue, endFrame } = createModel()

      endFrame.value = 80

      expect(modelValue.value.trim).toEqual({ start_time: 0, duration: 8.1 })
    })

    it('normalizes duration back to 0 when the end returns to the last frame', () => {
      const { modelValue, endFrame } = createModel({
        trim: { start_time: 1, duration: 7 }
      })

      endFrame.value = 99

      expect(modelValue.value.trim).toEqual({ start_time: 1, duration: 0 })
    })

    it('falls back to fps for conversions when the duration is unknown', () => {
      const { modelValue, startFrame } = createModel({}, { duration: 0 })

      startFrame.value = 10

      expect(modelValue.value.trim).toEqual({ start_time: 1, duration: 0 })
    })

    it('derives frames from an explicit trim window', () => {
      const { startFrame, endFrame } = createModel({
        trim: { start_time: 1, duration: 7 }
      })

      expect(startFrame.value).toBe(10)
      expect(endFrame.value).toBe(79)
    })

    it('keeps the end time fixed when the start moves inside an explicit window', () => {
      const { modelValue, startFrame } = createModel({
        trim: { start_time: 1, duration: 7 }
      })

      startFrame.value = 20

      expect(modelValue.value.trim).toEqual({ start_time: 2, duration: 6 })
    })

    it('clamps the start handle below the end handle instead of collapsing', () => {
      const { modelValue, startFrame, endFrame } = createModel({
        trim: { start_time: 1, duration: 7 }
      })

      startFrame.value = 90

      expect(modelValue.value.trim).toEqual({ start_time: 7.8, duration: 0.2 })
      expect(endFrame.value).toBe(79)
    })

    it('clamps the end handle above the start handle instead of snapping to the video end', () => {
      const { modelValue, startFrame, endFrame } = createModel({
        trim: { start_time: 1, duration: 7 }
      })

      endFrame.value = 5

      expect(modelValue.value.trim).toEqual({ start_time: 1, duration: 0.2 })
      expect(startFrame.value).toBe(10)
      expect(endFrame.value).toBe(11)
    })
  })

  describe('crop bounds', () => {
    it('shows the full frame for zero crop values', () => {
      const { cropBounds } = createModel()

      expect(cropBounds.value).toEqual({
        x: 0,
        y: 0,
        width: 1920,
        height: 1080
      })
    })

    it('rounds and stores a partial crop', () => {
      const { modelValue, cropBounds } = createModel()

      cropBounds.value = { x: 10.4, y: 20.6, width: 640.2, height: 360.5 }

      expect(modelValue.value.crop).toEqual({
        x: 10,
        y: 21,
        width: 640,
        height: 361
      })
    })

    it('clamps a rounded crop to stay inside the source frame', () => {
      const { modelValue, cropBounds } = createModel()

      cropBounds.value = { x: 10.6, y: 8.4, width: 1909.6, height: 1075.6 }

      const crop = modelValue.value.crop!
      expect(crop.x + crop.width).toBeLessThanOrEqual(1920)
      expect(crop.y + crop.height).toBeLessThanOrEqual(1080)
    })

    it('normalizes a full-frame crop back to zeros', () => {
      const { modelValue, cropBounds } = createModel({
        crop: { x: 10, y: 10, width: 100, height: 100 }
      })

      cropBounds.value = { x: 0, y: 0, width: 1920, height: 1080 }

      expect(modelValue.value.crop).toEqual({
        x: 0,
        y: 0,
        width: 0,
        height: 0
      })
    })
  })

  describe('section toggles', () => {
    it('starts disabled for no-op values', () => {
      const { trimEnabled, cropEnabled } = createModel()

      expect(trimEnabled.value).toBe(false)
      expect(cropEnabled.value).toBe(false)
    })

    it('starts enabled for active values', () => {
      const { trimEnabled, cropEnabled } = createModel({
        trim: { start_time: 1, duration: 0 },
        crop: { x: 0, y: 0, width: 640, height: 360 }
      })

      expect(trimEnabled.value).toBe(true)
      expect(cropEnabled.value).toBe(true)
    })

    it('resets the trim section when toggled off', () => {
      const { modelValue, trimEnabled } = createModel({
        trim: { start_time: 1, duration: 7 }
      })

      trimEnabled.value = false

      expect(modelValue.value.trim).toEqual({ start_time: 0, duration: 0 })
    })

    it('resets the crop section when toggled off', () => {
      const { modelValue, cropEnabled } = createModel({
        crop: { x: 10, y: 10, width: 640, height: 360 }
      })

      cropEnabled.value = false

      expect(modelValue.value.crop).toEqual({
        x: 0,
        y: 0,
        width: 0,
        height: 0
      })
    })

    it('expands the editor without touching the value when toggled on', () => {
      const { modelValue, trimEnabled } = createModel()

      trimEnabled.value = true

      expect(trimEnabled.value).toBe(true)
      expect(modelValue.value.trim).toBeUndefined()
    })

    it('auto-enables a section when an active value arrives later', async () => {
      const { modelValue, cropEnabled } = createModel()
      expect(cropEnabled.value).toBe(false)

      modelValue.value = {
        ...modelValue.value,
        crop: { x: 5, y: 5, width: 100, height: 100 }
      }
      await nextTick()

      expect(cropEnabled.value).toBe(true)
    })
  })
})
