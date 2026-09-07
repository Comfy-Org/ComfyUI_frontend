import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import type { Bounds } from '@/renderer/core/layout/types'

import { useCropRatioLock } from './useCropRatioLock'

function createLock(
  initial: Bounds,
  source: { width: number; height: number } = { width: 1920, height: 1080 }
) {
  const bounds = ref<Bounds>(initial)
  const lock = useCropRatioLock(bounds, {
    sourceWidth: ref(source.width),
    sourceHeight: ref(source.height)
  })
  return { bounds, ...lock }
}

describe('useCropRatioLock', () => {
  it('exposes the preset keys including custom', () => {
    const { ratioKeys } = createLock({ x: 0, y: 0, width: 640, height: 360 })

    expect(ratioKeys).toContain('16:9')
    expect(ratioKeys).toContain('1:1')
    expect(ratioKeys).toContain('custom')
  })

  it('reshapes the bounds when a preset is selected', () => {
    const { bounds, selectedRatio, lockedRatio } = createLock({
      x: 100,
      y: 100,
      width: 600,
      height: 500
    })

    selectedRatio.value = '1:1'

    expect(lockedRatio.value).toBe(1)
    expect(bounds.value).toEqual({ x: 100, y: 100, width: 600, height: 600 })
  })

  it('clamps the reshaped bounds to the source frame', () => {
    const { bounds, selectedRatio } = createLock({
      x: 0,
      y: 900,
      width: 1000,
      height: 100
    })

    selectedRatio.value = '1:1'

    expect(bounds.value.y + bounds.value.height).toBeLessThanOrEqual(1080)
    expect(bounds.value.width).toBe(bounds.value.height)
  })

  it('keeps the minimum size inside the frame at the bottom edge', () => {
    const { bounds, selectedRatio } = createLock({
      x: 0,
      y: 1070,
      width: 100,
      height: 10
    })

    selectedRatio.value = '1:1'

    expect(bounds.value.width).toBe(bounds.value.height)
    expect(bounds.value.width).toBeGreaterThanOrEqual(16)
    expect(bounds.value.y + bounds.value.height).toBeLessThanOrEqual(1080)
    expect(bounds.value.x).toBeGreaterThanOrEqual(0)
    expect(bounds.value.y).toBeGreaterThanOrEqual(0)
  })

  it('rejects preset selection before source metadata is available', () => {
    const { bounds, selectedRatio, lockedRatio, canLockRatio } = createLock(
      { x: 0, y: 0, width: 0, height: 0 },
      { width: 0, height: 0 }
    )

    expect(canLockRatio.value).toBe(false)

    selectedRatio.value = '1:1'

    expect(lockedRatio.value).toBeNull()
    expect(selectedRatio.value).toBe('custom')
    expect(bounds.value).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })

  it('rejects enabling the lock while the bounds are empty', () => {
    const { isLockEnabled, lockedRatio } = createLock({
      x: 0,
      y: 0,
      width: 0,
      height: 0
    })

    isLockEnabled.value = true

    expect(isLockEnabled.value).toBe(false)
    expect(lockedRatio.value).toBeNull()
  })

  it('captures the current ratio when the lock is enabled', () => {
    const { selectedRatio, isLockEnabled, lockedRatio } = createLock({
      x: 0,
      y: 0,
      width: 800,
      height: 400
    })

    isLockEnabled.value = true

    expect(lockedRatio.value).toBe(2)
    expect(selectedRatio.value).toBe('custom')
  })

  it('maps a captured ratio back to its preset key', () => {
    const { selectedRatio, isLockEnabled } = createLock({
      x: 0,
      y: 0,
      width: 640,
      height: 360
    })

    isLockEnabled.value = true

    expect(selectedRatio.value).toBe('16:9')
  })

  it('starts unlocked and clears the ratio when the lock is disabled', () => {
    const { selectedRatio, isLockEnabled, lockedRatio } = createLock({
      x: 0,
      y: 0,
      width: 640,
      height: 360
    })

    expect(selectedRatio.value).toBe('custom')
    expect(isLockEnabled.value).toBe(false)

    selectedRatio.value = '16:9'
    isLockEnabled.value = false

    expect(lockedRatio.value).toBeNull()
    expect(selectedRatio.value).toBe('custom')
  })
})
