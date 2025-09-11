import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import {
  LODLevel,
  LOD_THRESHOLDS,
  supportsFeatureAtZoom,
  useLOD
} from '@/renderer/extensions/vueNodes/lod/useLOD'

describe('useLOD', () => {
  describe('LOD level detection', () => {
    it('should return MINIMAL for zoom <= 0.4', () => {
      const zoomRef = ref(0.4)
      const { lodLevel } = useLOD(zoomRef)
      expect(lodLevel.value).toBe(LODLevel.MINIMAL)

      zoomRef.value = 0.2
      expect(lodLevel.value).toBe(LODLevel.MINIMAL)

      zoomRef.value = 0.1
      expect(lodLevel.value).toBe(LODLevel.MINIMAL)
    })

    it('should return REDUCED for 0.4 < zoom <= 0.8', () => {
      const zoomRef = ref(0.5)
      const { lodLevel } = useLOD(zoomRef)
      expect(lodLevel.value).toBe(LODLevel.REDUCED)

      zoomRef.value = 0.6
      expect(lodLevel.value).toBe(LODLevel.REDUCED)

      zoomRef.value = 0.8
      expect(lodLevel.value).toBe(LODLevel.REDUCED)
    })

    it('should return FULL for zoom > 0.8', () => {
      const zoomRef = ref(0.9)
      const { lodLevel } = useLOD(zoomRef)
      expect(lodLevel.value).toBe(LODLevel.FULL)

      zoomRef.value = 1.0
      expect(lodLevel.value).toBe(LODLevel.FULL)

      zoomRef.value = 2.5
      expect(lodLevel.value).toBe(LODLevel.FULL)
    })

    it('should be reactive to zoom changes', () => {
      const zoomRef = ref(0.2)
      const { lodLevel } = useLOD(zoomRef)

      expect(lodLevel.value).toBe(LODLevel.MINIMAL)

      zoomRef.value = 0.6
      expect(lodLevel.value).toBe(LODLevel.REDUCED)

      zoomRef.value = 1.0
      expect(lodLevel.value).toBe(LODLevel.FULL)
    })
  })

  describe('rendering decisions', () => {
    it('should disable all rendering for MINIMAL LOD', () => {
      const zoomRef = ref(0.2)
      const {
        shouldRenderWidgets,
        shouldRenderSlots,
        shouldRenderContent,
        shouldRenderSlotLabels,
        shouldRenderWidgetLabels
      } = useLOD(zoomRef)

      expect(shouldRenderWidgets.value).toBe(false)
      expect(shouldRenderSlots.value).toBe(false)
      expect(shouldRenderContent.value).toBe(false)
      expect(shouldRenderSlotLabels.value).toBe(false)
      expect(shouldRenderWidgetLabels.value).toBe(false)
    })

    it('should enable widgets/slots but disable labels for REDUCED LOD', () => {
      const zoomRef = ref(0.6)
      const {
        shouldRenderWidgets,
        shouldRenderSlots,
        shouldRenderContent,
        shouldRenderSlotLabels,
        shouldRenderWidgetLabels
      } = useLOD(zoomRef)

      expect(shouldRenderWidgets.value).toBe(true)
      expect(shouldRenderSlots.value).toBe(true)
      expect(shouldRenderContent.value).toBe(false)
      expect(shouldRenderSlotLabels.value).toBe(false)
      expect(shouldRenderWidgetLabels.value).toBe(false)
    })

    it('should enable all rendering for FULL LOD', () => {
      const zoomRef = ref(1.0)
      const {
        shouldRenderWidgets,
        shouldRenderSlots,
        shouldRenderContent,
        shouldRenderSlotLabels,
        shouldRenderWidgetLabels
      } = useLOD(zoomRef)

      expect(shouldRenderWidgets.value).toBe(true)
      expect(shouldRenderSlots.value).toBe(true)
      expect(shouldRenderContent.value).toBe(true)
      expect(shouldRenderSlotLabels.value).toBe(true)
      expect(shouldRenderWidgetLabels.value).toBe(true)
    })
  })

  describe('CSS classes', () => {
    it('should return correct CSS class for each LOD level', () => {
      const zoomRef = ref(0.2)
      const { lodCssClass } = useLOD(zoomRef)

      expect(lodCssClass.value).toBe('lg-node--lod-minimal')

      zoomRef.value = 0.6
      expect(lodCssClass.value).toBe('lg-node--lod-reduced')

      zoomRef.value = 1.0
      expect(lodCssClass.value).toBe('lg-node--lod-full')
    })
  })

  describe('essential widgets filtering', () => {
    it('should return all widgets for FULL LOD', () => {
      const zoomRef = ref(1.0)
      const { getEssentialWidgets } = useLOD(zoomRef)

      const widgets = [
        { type: 'combo' },
        { type: 'text' },
        { type: 'button' },
        { type: 'slider' }
      ]

      expect(getEssentialWidgets(widgets)).toEqual(widgets)
    })

    it('should return empty array for MINIMAL LOD', () => {
      const zoomRef = ref(0.2)
      const { getEssentialWidgets } = useLOD(zoomRef)

      const widgets = [{ type: 'combo' }, { type: 'text' }, { type: 'button' }]

      expect(getEssentialWidgets(widgets)).toEqual([])
    })

    it('should filter to essential types for REDUCED LOD', () => {
      const zoomRef = ref(0.6)
      const { getEssentialWidgets } = useLOD(zoomRef)

      const widgets = [
        { type: 'combo' },
        { type: 'text' },
        { type: 'button' },
        { type: 'slider' },
        { type: 'toggle' },
        { type: 'number' }
      ]

      const essential = getEssentialWidgets(widgets)
      expect(essential).toHaveLength(4)
      expect(essential.map((w: any) => w.type)).toEqual([
        'combo',
        'slider',
        'toggle',
        'number'
      ])
    })

    it('should handle case-insensitive widget types', () => {
      const zoomRef = ref(0.6)
      const { getEssentialWidgets } = useLOD(zoomRef)

      const widgets = [
        { type: 'COMBO' },
        { type: 'Select' },
        { type: 'TOGGLE' }
      ]

      const essential = getEssentialWidgets(widgets)
      expect(essential).toHaveLength(3)
    })

    it('should handle widgets with undefined or missing type', () => {
      const zoomRef = ref(0.6)
      const { getEssentialWidgets } = useLOD(zoomRef)

      const widgets = [
        { type: 'combo' },
        { type: undefined },
        {},
        { type: 'slider' }
      ]

      const essential = getEssentialWidgets(widgets)
      expect(essential).toHaveLength(2)
      expect(essential.map((w: any) => w.type)).toEqual(['combo', 'slider'])
    })
  })

  describe('performance metrics', () => {
    it('should provide debug metrics', () => {
      const zoomRef = ref(0.6)
      const { lodMetrics } = useLOD(zoomRef)

      expect(lodMetrics.value).toEqual({
        level: LODLevel.REDUCED,
        zoom: 0.6,
        widgetCount: 'full',
        slotCount: 'full'
      })
    })

    it('should update metrics when zoom changes', () => {
      const zoomRef = ref(0.2)
      const { lodMetrics } = useLOD(zoomRef)

      expect(lodMetrics.value.level).toBe(LODLevel.MINIMAL)
      expect(lodMetrics.value.widgetCount).toBe('none')
      expect(lodMetrics.value.slotCount).toBe('none')

      zoomRef.value = 1.0
      expect(lodMetrics.value.level).toBe(LODLevel.FULL)
      expect(lodMetrics.value.widgetCount).toBe('full')
      expect(lodMetrics.value.slotCount).toBe('full')
    })
  })
})

describe('LOD_THRESHOLDS', () => {
  it('should export correct threshold values', () => {
    expect(LOD_THRESHOLDS.FULL_THRESHOLD).toBe(0.8)
    expect(LOD_THRESHOLDS.REDUCED_THRESHOLD).toBe(0.4)
    expect(LOD_THRESHOLDS.MINIMAL_THRESHOLD).toBe(0.0)
  })
})

describe('supportsFeatureAtZoom', () => {
  it('should return correct feature support for different zoom levels', () => {
    expect(supportsFeatureAtZoom(1.0, 'renderWidgets')).toBe(true)
    expect(supportsFeatureAtZoom(1.0, 'renderSlots')).toBe(true)
    expect(supportsFeatureAtZoom(1.0, 'renderContent')).toBe(true)

    expect(supportsFeatureAtZoom(0.6, 'renderWidgets')).toBe(true)
    expect(supportsFeatureAtZoom(0.6, 'renderSlots')).toBe(true)
    expect(supportsFeatureAtZoom(0.6, 'renderContent')).toBe(false)

    expect(supportsFeatureAtZoom(0.2, 'renderWidgets')).toBe(false)
    expect(supportsFeatureAtZoom(0.2, 'renderSlots')).toBe(false)
    expect(supportsFeatureAtZoom(0.2, 'renderContent')).toBe(false)
  })

  it('should handle threshold boundary values correctly', () => {
    expect(supportsFeatureAtZoom(0.8, 'renderWidgets')).toBe(true)
    expect(supportsFeatureAtZoom(0.8, 'renderContent')).toBe(false)

    expect(supportsFeatureAtZoom(0.81, 'renderContent')).toBe(true)

    expect(supportsFeatureAtZoom(0.4, 'renderWidgets')).toBe(false)
    expect(supportsFeatureAtZoom(0.41, 'renderWidgets')).toBe(true)
  })
})
