import { onScopeDispose, watchEffect } from 'vue'

import { setGestureSnapProvider } from '@/lib/litegraph/src/canvas/gestureSnap'

import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { useSettingStore } from '@/platform/settings/settingStore'

import { smartGuidesProvider } from './dragSnapSession'
import { smartGuidesConfig } from './smartGuidesState'

const SMART_GUIDES_EXTENSION = 'nomadoor.SmartGuides'

/** Installs smart guide snapping and keeps its config in sync with settings. */
export function useSmartGuidesSettings() {
  const settingStore = useSettingStore()
  const extensionStore = useExtensionStore()

  onScopeDispose(setGestureSnapProvider(smartGuidesProvider))

  watchEffect(() => {
    const extensionActive =
      extensionStore.isExtensionInstalled(SMART_GUIDES_EXTENSION) &&
      extensionStore.isExtensionEnabled(SMART_GUIDES_EXTENSION)
    Object.assign(smartGuidesConfig, {
      enabled:
        settingStore.get('Comfy.Canvas.SmartGuides.Enabled') &&
        !settingStore.get('pysssss.SnapToGrid') &&
        !extensionActive,
      edges: settingStore.get('Comfy.Canvas.SmartGuides.SnapToEdges'),
      wires: settingStore.get('Comfy.Canvas.SmartGuides.SnapToWires'),
      spacing: settingStore.get('Comfy.Canvas.SmartGuides.SnapToSpacing'),
      distance: settingStore.get('Comfy.Canvas.SmartGuides.SnapDistance'),
      gap: settingStore.get('Comfy.Canvas.SmartGuides.Gap')
    })
  })
}
