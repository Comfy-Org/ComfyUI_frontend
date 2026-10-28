import { computed, onMounted, watch } from 'vue'

import { useNodePricing } from '@/composables/node/useNodePricing'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { useCustomNodeStore } from '@/platform/customNodes/stores/customNodeStore'
import { installNodeBadges } from '@/systems/badgeSystem'

/**
 * Bootstraps badge derivation: installs it as the legacy canvas's row
 * source and keeps the legacy canvas redrawing when badge sources change.
 */
export const useNodeBadge = () => {
  const settingStore = useSettingStore()
  const customNodeStore = useCustomNodeStore()
  const canvasStore = useCanvasStore()

  const showApiPricingBadge = computed(() =>
    settingStore.get('Comfy.NodeBadge.ShowApiPricing')
  )

  watch(
    [
      () => settingStore.get('Comfy.NodeBadge.NodeSourceBadgeMode'),
      () => settingStore.get('Comfy.NodeBadge.NodeIdBadgeMode'),
      () => settingStore.get('Comfy.NodeBadge.NodeLifeCycleBadgeMode'),
      showApiPricingBadge
    ],
    () => {
      canvasStore.canvas?.setDirty(true, true)
    }
  )

  onMounted(() => {
    if (customNodeStore.isExtensionInstalled('Comfy.NodeBadge')) return

    const nodePricing = useNodePricing()

    watch(
      () => nodePricing.pricingRevision.value,
      () => {
        if (!showApiPricingBadge.value) return
        canvasStore.canvas?.setDirty(true, true)
      }
    )

    customNodeStore.registerExtension({
      name: 'Comfy.NodeBadge',
      init() {
        installNodeBadges()
        app.canvas.canvas.addEventListener<'litegraph:set-graph'>(
          'litegraph:set-graph',
          () => {
            canvasStore.canvas?.setDirty(true, true)
          }
        )
      }
    })
  })
}
