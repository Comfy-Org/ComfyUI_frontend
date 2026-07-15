import { computed, onMounted, onUnmounted, watch } from 'vue'

import { useNodePricing } from '@/composables/node/useNodePricing'
import { useSettingStore } from '@/platform/settings/settingStore'
import { app } from '@/scripts/app'
import { useExtensionStore } from '@/stores/extensionStore'
import {
  bumpSubgraphCreditsRevision,
  startBadgeSystem
} from '@/systems/badgeSystem'
import { resolveNode } from '@/utils/litegraphUtil'

/**
 * Bootstraps the badge system: starts it against the live root graph,
 * forwards the subgraph structure events its store sources cannot
 * observe, and keeps the legacy canvas redrawing when badge sources
 * change.
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

  let stopBadgeSystem: (() => void) | undefined
  onUnmounted(() => stopBadgeSystem?.())

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
        stopBadgeSystem = startBadgeSystem({
          resolveGraphId: () => app.rootGraph.id,
          resolveNode: (nodeId) => resolveNode(nodeId, app.rootGraph)
        })
        app.canvas.canvas.addEventListener<'litegraph:set-graph'>(
          'litegraph:set-graph',
          () => {
            bumpSubgraphCreditsRevision()
            app.canvas?.setDirty(true, true)
          }
        )
        app.canvas.canvas.addEventListener<'subgraph-converted'>(
          'subgraph-converted',
          () => {
            bumpSubgraphCreditsRevision()
          }
        )
      },
      afterConfigureGraph() {
        bumpSubgraphCreditsRevision()
      }
    })
  })
}
