<template>
  <div>
    <!-- This component does not render anything visible. -->
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useSettingStore } from '@/stores/settingStore'
import {
  defaultColorPalette,
  getColorPalette
} from '@/extensions/core/colorPalette'
import { app } from '@/scripts/app'
import type { LGraphNode } from '@comfyorg/litegraph'
import { BadgePosition } from '@comfyorg/litegraph'
import { LGraphBadge } from '@comfyorg/litegraph'
import _ from 'lodash'
import { NodeBadgeMode } from '@/types/nodeSource'
import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'
import type { Palette } from '@/types/colorPalette'

const settingStore = useSettingStore()
const nodeSourceBadgeMode = computed(
  () => settingStore.get('Comfy.NodeBadge.NodeSourceBadgeMode') as NodeBadgeMode
)
const nodeIdBadgeMode = computed(
  () => settingStore.get('Comfy.NodeBadge.NodeIdBadgeMode') as NodeBadgeMode
)
const nodeLifeCycleBadgeMode = computed(
  () =>
    settingStore.get('Comfy.NodeBadge.NodeLifeCycleBadgeMode') as NodeBadgeMode
)

watch([nodeSourceBadgeMode, nodeIdBadgeMode, nodeLifeCycleBadgeMode], () => {
  app.graph?.setDirtyCanvas(true, true)
})

const colorPalette = computed<Palette | undefined>(() =>
  getColorPalette(settingStore.get('Comfy.ColorPalette'))
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
  app.registerExtension({
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
            colorPalette.value?.colors?.litegraph_base?.BADGE_FG_COLOR ||
            defaultColorPalette.colors.litegraph_base.BADGE_FG_COLOR,
          bgColor:
            colorPalette.value?.colors?.litegraph_base?.BADGE_BG_COLOR ||
            defaultColorPalette.colors.litegraph_base.BADGE_BG_COLOR
        })
      })

      node.badges.push(() => badge.value)
    }
  })
})
</script>
