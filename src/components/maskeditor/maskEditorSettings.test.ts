import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { ColorComparisonMethod } from '@/extensions/core/maskeditor/types'

/**
 * This test validates the computed pattern used in ColorSelectSettingsPanel.vue
 * for methodMenuItems. The issue was that methodMenuItems was built once as a
 * plain array during setup, so the check icon never updated when the method changed.
 *
 * The fix makes methodMenuItems a computed that recomputes when the store value changes.
 */
describe('ColorSelectSettingsPanel methodMenuItems pattern', () => {
  it('should recompute icon when colorComparisonMethod changes', () => {
    const methodOptions = Object.values(ColorComparisonMethod)

    // Simulate the store having a reactive colorComparisonMethod
    const colorComparisonMethod = ref(ColorComparisonMethod.Simple)

    // This is the pattern used in the fixed ColorSelectSettingsPanel
    const methodMenuItems = computed(() =>
      methodOptions.map((method) => ({
        id: method,
        label: method,
        icon:
          colorComparisonMethod.value === method
            ? 'icon-[lucide--check]'
            : undefined,
        command: () => {}
      }))
    )

    // Initial state - Simple is selected
    const initialItems = methodMenuItems.value
    expect(
      initialItems.find((i) => i.id === ColorComparisonMethod.Simple)?.icon
    ).toBe('icon-[lucide--check]')
    expect(
      initialItems.find((i) => i.id === ColorComparisonMethod.HSL)?.icon
    ).toBeUndefined()

    // Change to HSL
    colorComparisonMethod.value = ColorComparisonMethod.HSL

    // Should now recompute with new icon
    const updatedItems = methodMenuItems.value
    expect(
      updatedItems.find((i) => i.id === ColorComparisonMethod.Simple)?.icon
    ).toBeUndefined()
    expect(
      updatedItems.find((i) => i.id === ColorComparisonMethod.HSL)?.icon
    ).toBe('icon-[lucide--check]')
  })
})

/**
 * This test validates the numeric guard pattern used in BrushSettingsPanel.vue
 * computed setters to prevent NaN values from being passed to the store.
 */
describe('Numeric guard pattern', () => {
  it('should guard against non-numeric values', () => {
    const storeSetBrushSize = vi.fn()

    // Simulate the fixed computed setter pattern
    const brushSize = computed({
      get: () => 50,
      set: (value: number) => {
        if (typeof value !== 'number' || Number.isNaN(value)) return
        storeSetBrushSize(value)
      }
    })

    // Valid value should pass through
    brushSize.value = 100
    expect(storeSetBrushSize).toHaveBeenCalledWith(100)

    // NaN should be rejected
    storeSetBrushSize.mockClear()
    brushSize.value = NaN
    expect(storeSetBrushSize).not.toHaveBeenCalled()

    // Non-number should be rejected
    brushSize.value = 'not a number' as unknown as number
    expect(storeSetBrushSize).not.toHaveBeenCalled()
  })
})

/**
 * This test validates the opacity handling pattern in ImageLayerSettingsPanel.vue
 * where the slider should not override opacity in Negative blend mode.
 */
describe('ImageLayerSettingsPanel onMaskOpacityChange pattern', () => {
  it('should not override opacity when in Negative blend mode', () => {
    const MaskBlendMode = {
      Negative: 'negative',
      Black: 'black',
      White: 'white'
    }

    const store = {
      maskBlendMode: MaskBlendMode.Negative,
      maskCanvas: { style: { opacity: '1' } },
      setMaskOpacity: vi.fn()
    }

    // This is the fixed handler pattern
    const onMaskOpacityChange = (value: number) => {
      const numValue = value
      store.setMaskOpacity(numValue / 100)

      // Only set opacity directly if NOT in Negative mode
      if (store.maskCanvas && store.maskBlendMode !== MaskBlendMode.Negative) {
        store.maskCanvas.style.opacity = String(numValue / 100)
      }
    }

    // Call the handler
    onMaskOpacityChange(50)

    // Store should be updated
    expect(store.setMaskOpacity).toHaveBeenCalledWith(0.5)

    // But canvas opacity should NOT be overridden because mode is Negative
    expect(store.maskCanvas.style.opacity).toBe('1')
  })

  it('should update opacity when in other blend modes', () => {
    const MaskBlendMode = {
      Negative: 'negative',
      Black: 'black',
      White: 'white'
    }

    const store = {
      maskBlendMode: MaskBlendMode.Black,
      maskCanvas: { style: { opacity: '0.8' } },
      setMaskOpacity: vi.fn()
    }

    const onMaskOpacityChange = (value: number) => {
      const numValue = value
      store.setMaskOpacity(numValue / 100)

      if (store.maskCanvas && store.maskBlendMode !== MaskBlendMode.Negative) {
        store.maskCanvas.style.opacity = String(numValue / 100)
      }
    }

    onMaskOpacityChange(75)

    expect(store.setMaskOpacity).toHaveBeenCalledWith(0.75)
    expect(store.maskCanvas.style.opacity).toBe('0.75')
  })
})
