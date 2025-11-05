import _ from 'es-toolkit/compat'
import { computed, onMounted, watch } from 'vue'

import { useNodePricing } from '@/composables/node/useNodePricing'
import { usePriceBadge } from '@/composables/node/usePriceBadge'
import { useComputedWithWidgetWatch } from '@/composables/node/useWatchWidget'
import { BadgePosition, LGraphBadge } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { app } from '@/scripts/app'
import { useExtensionStore } from '@/stores/extensionStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { NodeBadgeMode } from '@/types/nodeSource'

/**
 * Add LGraphBadge to LGraphNode based on settings.
 *
 * Following badges are added:
 * - Node ID badge
 * - Node source badge
 * - Node life cycle badge
 * - API node credits badge
 */
export const useNodeBadge = () => {
  const settingStore = useSettingStore()
  const extensionStore = useExtensionStore()
  const colorPaletteStore = useColorPaletteStore()
  const priceBadge = usePriceBadge()

  const nodeSourceBadgeMode = computed(
    () =>
      settingStore.get('Comfy.NodeBadge.NodeSourceBadgeMode') as NodeBadgeMode
  )
  const nodeIdBadgeMode = computed(
    () => settingStore.get('Comfy.NodeBadge.NodeIdBadgeMode') as NodeBadgeMode
  )
  const nodeLifeCycleBadgeMode = computed(
    () =>
      settingStore.get(
        'Comfy.NodeBadge.NodeLifeCycleBadgeMode'
      ) as NodeBadgeMode
  )

  const showApiPricingBadge = computed(() =>
    settingStore.get('Comfy.NodeBadge.ShowApiPricing')
  )

  watch(
    [
      nodeSourceBadgeMode,
      nodeIdBadgeMode,
      nodeLifeCycleBadgeMode,
      showApiPricingBadge
    ],
    () => {
      app.graph?.setDirtyCanvas(true, true)
    }
  )

  const nodeDefStore = useNodeDefStore()
  function badgeTextVisible(
    nodeDef: ComfyNodeDefImpl | null,
    badgeMode: NodeBadgeMode
  ): boolean {
    return !(
      badgeMode === NodeBadgeMode.None ||
      (nodeDef?.isCoreNode && badgeMode === NodeBadgeMode.HideBuiltIn)
    )
  }

  onMounted(() => {
    const nodePricing = useNodePricing()

    extensionStore.registerExtension({
      name: 'Comfy.NodeBadge',
      nodeCreated(node: LGraphNode) {
        node.badgePosition = BadgePosition.TopRight

        const badge = computed(() => {
          const nodeDef = nodeDefStore.fromLGraphNode(node)
          return new LGraphBadge({
            text: _.truncate(
              [
                badgeTextVisible(nodeDef, nodeIdBadgeMode.value)
                  ? `#${node.id}`
                  : '',
                badgeTextVisible(nodeDef, nodeLifeCycleBadgeMode.value)
                  ? (nodeDef?.nodeLifeCycleBadgeText ?? '')
                  : '',
                badgeTextVisible(nodeDef, nodeSourceBadgeMode.value)
                  ? (nodeDef?.nodeSource?.badgeText ?? '')
                  : ''
              ]
                .filter((s) => s.length > 0)
                .join(' '),
              {
                length: 31
              }
            ),
            fgColor:
              colorPaletteStore.completedActivePalette.colors.litegraph_base
                .BADGE_FG_COLOR,
            bgColor:
              colorPaletteStore.completedActivePalette.colors.litegraph_base
                .BADGE_BG_COLOR
          })
        })

        node.badges.push(() => badge.value)

        if (node.constructor.nodeData?.api_node && showApiPricingBadge.value) {
          // Get the pricing function to determine if this node has dynamic pricing
          const pricingConfig = nodePricing.getNodePricingConfig(node)
          const hasDynamicPricing =
            typeof pricingConfig?.displayPrice === 'function'

          let creditsBadge
          const createBadge = () => {
            const price = nodePricing.getNodeDisplayPrice(node)
            return priceBadge.getCreditsBadge(price)
          }

          if (hasDynamicPricing) {
            // For dynamic pricing nodes, use computed that watches widget changes
            const relevantWidgetNames = nodePricing.getRelevantWidgetNames(
              node.constructor.nodeData?.name
            )

            const computedWithWidgetWatch = useComputedWithWidgetWatch(node, {
              widgetNames: relevantWidgetNames,
              triggerCanvasRedraw: true
            })

            creditsBadge = computedWithWidgetWatch(createBadge)
          } else {
            // For static pricing nodes, use regular computed
            creditsBadge = computed(createBadge)
          }

          node.badges.push(() => creditsBadge.value)
        }
      },
      init() {
        app.canvas.canvas.addEventListener<'litegraph:set-graph'>(
          'litegraph:set-graph',
          () => {
            for (const node of app.canvas.graph?.nodes ?? [])
              priceBadge.updateSubgraphCredits(node)
          }
        )
        app.canvas.canvas.addEventListener<'subgraph-converted'>(
          'subgraph-converted',
          (e) => priceBadge.updateSubgraphCredits(e.detail.subgraphNode)
        )
      },
      afterConfigureGraph() {
        for (const node of app.canvas.graph?.nodes ?? [])
          priceBadge.updateSubgraphCredits(node)
      }
    })
  })
}
