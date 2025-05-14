import {
  BadgePosition,
  LGraphBadge,
  type LGraphNode
} from '@comfyorg/litegraph'
import _ from 'lodash'
import { computed, onMounted, watch } from 'vue'

import { app } from '@/scripts/app'
import { useExtensionStore } from '@/stores/extensionStore'
import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'
import { useSettingStore } from '@/stores/settingStore'
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

  watch([nodeSourceBadgeMode, nodeIdBadgeMode, nodeLifeCycleBadgeMode], () => {
    app.graph?.setDirtyCanvas(true, true)
  })

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

        if (node.constructor.nodeData?.api_node) {
          const creditsBadge = computed(() => {
            return new LGraphBadge({
              text: '',
              iconOptions: {
                unicode: '\ue96b',
                fontFamily: 'PrimeIcons',
                color: '#FABC25',
                bgColor: '#353535',
                fontSize: 8
              },
              fgColor:
                colorPaletteStore.completedActivePalette.colors.litegraph_base
                  .BADGE_FG_COLOR,
              bgColor:
                colorPaletteStore.completedActivePalette.colors.litegraph_base
                  .BADGE_BG_COLOR
            })
          })

          node.badges.push(() => creditsBadge.value)
        }
      }
    })
  })
}
