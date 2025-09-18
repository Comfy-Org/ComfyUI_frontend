/**
 * Level of Detail (LOD) composable for Vue-based node rendering
 *
 * Provides dynamic quality adjustment based on zoom level to maintain
 * performance with large node graphs. Uses zoom thresholds to determine
 * how much detail to render for each node component.
 **/
import type { Ref } from 'vue'
import { watchEffect } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'

interface Camera {
  z: number // zoom level
}

export function useLOD(camera: Camera, isLOD: Ref<boolean>) {
  const settingStore = useSettingStore()

  const baseFontSize = 14
  const dprAdjustment = Math.sqrt(window.devicePixelRatio || 1)

  // Set a default min font size & threshold in case store unavaliable
  let minFontSize = 12
  let threshold = 0.4

  watchEffect(() => {
    const minFontSizeFromStore = settingStore.get(
      'LiteGraph.Canvas.MinFontSizeForLOD'
    )
    if (minFontSizeFromStore) {
      minFontSize = minFontSizeFromStore
    }
    threshold =
      Math.round((minFontSize / (baseFontSize * dprAdjustment)) * 100) / 100 //round to 2 decimal places i.e 0.86
  })

  watchEffect(() => {
    isLOD.value = camera.z < threshold
  })
}
