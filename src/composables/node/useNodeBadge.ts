import {
  BadgePosition,
  LGraphBadge,
  type LGraphNode
} from '@comfyorg/litegraph'
import _ from 'lodash'
import { computed, onMounted, watch } from 'vue'

import { useNodePricing } from '@/composables/node/useNodePricing'
import { app } from '@/scripts/app'
import { useExtensionStore } from '@/stores/extensionStore'
import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'
import { useSettingStore } from '@/stores/settingStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { NodeBadgeMode } from '@/types/nodeSource'
import { adjustColor } from '@/utils/colorUtil'

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
                  ? nodeDef?.nodeLifeCycleBadgeText ?? ''
                  : '',
                badgeTextVisible(nodeDef, nodeSourceBadgeMode.value)
                  ? nodeDef?.nodeSource?.badgeText ?? ''
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
          const price = nodePricing.getNodeDisplayPrice(node)
          // Always add the badge for API nodes, with or without price text
          const creditsBadge = computed(() => {
            // Use dynamic background color based on the theme
            const isLightTheme =
              colorPaletteStore.completedActivePalette.light_theme
            return new LGraphBadge({
              text: price,
              iconOptions: {
                unicode: '\ue96b',
                fontFamily: 'PrimeIcons',
                color: isLightTheme
                  ? adjustColor('#FABC25', { lightness: 0.5 })
                  : '#FABC25',
                bgColor: isLightTheme
                  ? adjustColor('#654020', { lightness: 0.5 })
                  : '#654020',
                fontSize: 8
              },
              fgColor:
                colorPaletteStore.completedActivePalette.colors.litegraph_base
                  .BADGE_FG_COLOR,
              bgColor: isLightTheme
                ? adjustColor('#8D6932', { lightness: 0.5 })
                : '#8D6932'
            })
          })

          node.badges.push(() => creditsBadge.value)
        }
      }
    })
  })
}
