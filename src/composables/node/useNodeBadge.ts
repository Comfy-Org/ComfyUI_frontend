import { computed, onMounted, watch } from 'vue'

import { useNodePricing } from '@/composables/node/useNodePricing'
import { useComputedWithWidgetWatch } from '@/composables/node/useWatchWidget'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { app } from '@/scripts/app'
import { useExtensionStore } from '@/stores/extensionStore'
import {
  bumpSubgraphCreditsRevision,
  startBadgeSystem
} from '@/systems/badgeSystem'
import { resolveNode } from '@/utils/litegraphUtil'

/**
 * Bootstraps the badge system (see docs/architecture/node-badge-store.md):
 * starts it against the active root graph, restarts it when the workflow
 * is reconfigured, forwards the subgraph structure events the system's
 * store sources cannot observe, and keeps the legacy canvas redrawing
 * when badge sources change. Dynamic-pricing recalculation wiring stays
 * here because it drives price evaluation, not badge storage.
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

    let stopSystem: (() => void) | undefined
    function restartSystem(): void {
      stopSystem?.()
      const rootGraph = app.rootGraph
      stopSystem = startBadgeSystem({
        graphId: rootGraph.id,
        resolveNode: (nodeId) => resolveNode(nodeId, rootGraph)
      })
    }

    function wirePricingRecalculation(node: LGraphNode): void {
      // JSONata rules are dynamic if they depend on any widgets/inputs/input_groups
      const pricingConfig = nodePricing.getNodePricingConfig(node)
      const hasDynamicPricing =
        !!pricingConfig &&
        ((pricingConfig.depends_on?.widgets?.length ?? 0) > 0 ||
          (pricingConfig.depends_on?.inputs?.length ?? 0) > 0 ||
          (pricingConfig.depends_on?.input_groups?.length ?? 0) > 0)
      if (!hasDynamicPricing) return

      const relevantWidgetNames = nodePricing.getRelevantWidgetNames(
        node.constructor.nodeData?.name ?? ''
      )
      const computedWithWidgetWatch = useComputedWithWidgetWatch(node, {
        widgetNames: relevantWidgetNames,
        triggerCanvasRedraw: true
      })
      // Installs the widget listeners; the returned value is unused.
      computedWithWidgetWatch(() => 0)

      const relevantInputs = pricingConfig?.depends_on?.inputs ?? []
      const inputGroupPrefixes = pricingConfig?.depends_on?.input_groups ?? []
      if (relevantInputs.length === 0 && inputGroupPrefixes.length === 0) return

      const originalOnConnectionsChange = node.onConnectionsChange
      node.onConnectionsChange = function (
        type,
        slotIndex,
        isConnected,
        link,
        ioSlot
      ) {
        originalOnConnectionsChange?.call(
          this,
          type,
          slotIndex,
          isConnected,
          link,
          ioSlot
        )
        const inputName = ioSlot?.name
        if (!inputName) return
        const isRelevantInput =
          relevantInputs.includes(inputName) ||
          inputGroupPrefixes.some((prefix) =>
            inputName.startsWith(prefix + '.')
          )
        if (isRelevantInput) {
          nodePricing.triggerPriceRecalculation(node)
        }
      }
    }

    extensionStore.registerExtension({
      name: 'Comfy.NodeBadge',
      nodeCreated(node: LGraphNode) {
        if (node.constructor.nodeData?.api_node && showApiPricingBadge.value) {
          wirePricingRecalculation(node)
        }
      },
      init() {
        restartSystem()
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
        restartSystem()
        bumpSubgraphCreditsRevision()
      }
    })
  })
}
