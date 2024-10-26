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
import { NodeBadgeMode, NodeSource, NodeSourceType } from '@/types/nodeSource'
import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'

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

const colorPalette = computed(() =>
  getColorPalette(settingStore.get('Comfy.ColorPalette'))
)

const nodeDefStore = useNodeDefStore()
function getNodeDef(node: LGraphNode): ComfyNodeDefImpl | null {
  const nodeDef = node.constructor.nodeData
  // Frontend-only nodes don't have nodeDef
  if (!nodeDef) {
    return null
  }
  return nodeDefStore.nodeDefsByName[nodeDef.name]
}

function getNodeSource(node: LGraphNode): NodeSource | null {
  return getNodeDef(node)?.nodeSource ?? null
}

function isCoreNode(node: LGraphNode) {
  return getNodeSource(node)?.type === NodeSourceType.Core
}

function badgeTextVisible(node: LGraphNode, badgeMode: NodeBadgeMode): boolean {
  return (
    badgeMode === NodeBadgeMode.None ||
    (isCoreNode(node) && badgeMode === NodeBadgeMode.HideBuiltIn)
  )
}

function getNodeIdBadgeText(node: LGraphNode, nodeIdBadgeMode: NodeBadgeMode) {
  return badgeTextVisible(node, nodeIdBadgeMode) ? '' : `#${node.id}`
}

function getNodeSourceBadgeText(
  node: LGraphNode,
  nodeSourceBadgeMode: NodeBadgeMode
) {
  const nodeSource = getNodeSource(node)
  return badgeTextVisible(node, nodeSourceBadgeMode)
    ? ''
    : nodeSource?.badgeText ?? ''
}

function getNodeLifeCycleBadgeText(
  node: LGraphNode,
  nodeLifeCycleBadgeMode: NodeBadgeMode
) {
  if (badgeTextVisible(node, nodeLifeCycleBadgeMode)) {
    return ''
  }

  const nodeDef = getNodeDef(node)
  if (!nodeDef) return ''
  if (nodeDef.deprecated) return '[DEPR]'
  if (nodeDef.experimental) return '[BETA]'

  return ''
}

onMounted(() => {
  app.registerExtension({
    name: 'Comfy.NodeBadge',
    nodeCreated(node: LGraphNode) {
      node.badgePosition = BadgePosition.TopRight

      const badge = computed(
        () =>
          new LGraphBadge({
            text: _.truncate(
              [
                getNodeIdBadgeText(node, nodeIdBadgeMode.value),
                getNodeLifeCycleBadgeText(node, nodeLifeCycleBadgeMode.value),
                getNodeSourceBadgeText(node, nodeSourceBadgeMode.value)
              ]
                .filter((s) => s.length > 0)
                .join(' '),
              {
                length: 31
              }
            ),
            fgColor:
              colorPalette.value.colors.litegraph_base?.BADGE_FG_COLOR ||
              defaultColorPalette.colors.litegraph_base.BADGE_FG_COLOR,
            bgColor:
              colorPalette.value.colors.litegraph_base?.BADGE_BG_COLOR ||
              defaultColorPalette.colors.litegraph_base.BADGE_BG_COLOR
          })
      )

      node.badges.push(() => badge.value)
    }
  })
})
</script>
