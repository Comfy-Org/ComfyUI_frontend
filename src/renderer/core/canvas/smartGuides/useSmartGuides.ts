import { onScopeDispose } from 'vue'

import { registerGestureSnapProvider } from '@/lib/litegraph/src/canvas/gestureSnap'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { useSettingStore } from '@/platform/settings/settingStore'

import { createSmartGuidesProvider } from './dragSnapSession'

const SMART_GUIDES_EXTENSION = 'nomadoor.SmartGuides'

/** Installs smart guide snapping for both renderers while the calling scope lives. */
export function useSmartGuides() {
  const settingStore = useSettingStore()
  const extensionStore = useExtensionStore()

  function extensionActive() {
    return (
      extensionStore.isExtensionInstalled(SMART_GUIDES_EXTENSION) &&
      extensionStore.isExtensionEnabled(SMART_GUIDES_EXTENSION)
    )
  }

  onScopeDispose(
    registerGestureSnapProvider(
      createSmartGuidesProvider(() => ({
        enabled:
          settingStore.get('Comfy.Canvas.SmartGuides.Enabled') &&
          !settingStore.get('pysssss.SnapToGrid') &&
          !extensionActive(),
        edges: settingStore.get('Comfy.Canvas.SmartGuides.SnapToEdges'),
        wires: settingStore.get('Comfy.Canvas.SmartGuides.SnapToWires'),
        spacing: settingStore.get('Comfy.Canvas.SmartGuides.SnapToSpacing'),
        distance: settingStore.get('Comfy.Canvas.SmartGuides.SnapDistance'),
        gap: settingStore.get('Comfy.Canvas.SmartGuides.Gap')
      }))
    )
  )
}
