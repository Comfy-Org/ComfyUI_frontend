/**
 * Level of Detail (LOD) composable for Vue-based node rendering
 *
 * Provides dynamic quality adjustment based on zoom level to maintain
 * performance with large node graphs. Uses zoom threshold based on DPR
 * to determine how much detail to render for each node component.
 * Default minFontSize = 8px
 * Default zoomThreshold = 0.57 (On a DPR = 1 monitor)
 **/
import { useDevicePixelRatio } from '@vueuse/core'
import { computed } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'

interface Camera {
  z: number // zoom level
}

export function useLOD(camera: Camera) {
  const isLOD = computed(() => {
    const { pixelRatio } = useDevicePixelRatio()
    const baseFontSize = 14
    const dprAdjustment = Math.sqrt(pixelRatio.value)

    const settingStore = useSettingStore()
    const minFontSize = settingStore.get('LiteGraph.Canvas.MinFontSizeForLOD') //default 8
    const threshold =
      Math.round((minFontSize / (baseFontSize * dprAdjustment)) * 100) / 100 //round to 2 decimal places i.e 0.86

    return camera.z < threshold
  })

  return { isLOD }
}
