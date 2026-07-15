import { computed, onMounted, watch } from 'vue'

import { useNodePricing } from '@/composables/node/useNodePricing'
import { bumpGraphStructureRevision } from '@/lib/litegraph/src/graphStructureRevision'
import { useSettingStore } from '@/platform/settings/settingStore'
import { app } from '@/scripts/app'
import { useExtensionStore } from '@/stores/extensionStore'
import { installNodeBadges } from '@/systems/badgeSystem'

/**
 * Bootstraps badge derivation: installs it as the legacy canvas's row
 * source, forwards the structure events instance state cannot announce,
 * and keeps the legacy canvas redrawing when badge sources change.
 */
export const useNodeBadge = () => {
  const settingStore = useSettingStore()
  const extensionStore = useExtensionStore()

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
      app.canvas?.setDirty(true, true)
    }
  )

  onMounted(() => {
    if (extensionStore.isExtensionInstalled('Comfy.NodeBadge')) return

    const nodePricing = useNodePricing()

    watch(
      () => nodePricing.pricingRevision.value,
      () => {
        if (!showApiPricingBadge.value) return
        app.canvas?.setDirty(true, true)
      }
    )

    extensionStore.registerExtension({
      name: 'Comfy.NodeBadge',
      init() {
        installNodeBadges()
        app.canvas.canvas.addEventListener<'litegraph:set-graph'>(
          'litegraph:set-graph',
          () => {
            bumpGraphStructureRevision()
            app.canvas?.setDirty(true, true)
          }
        )
        app.canvas.canvas.addEventListener<'subgraph-converted'>(
          'subgraph-converted',
          () => {
            bumpGraphStructureRevision()
          }
        )
      },
      afterConfigureGraph() {
        bumpGraphStructureRevision()
      }
    })
  })
}
