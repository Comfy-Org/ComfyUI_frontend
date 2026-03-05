<template>
  <div
    class="group relative flex flex-col items-center justify-center py-3 px-2 rounded-lg cursor-pointer select-none transition-colors duration-150 box-content bg-component-node-background hover:bg-secondary-background-hover"
    :data-node-name="node.label"
    draggable="true"
    @click="handleClick"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <i :class="cn(nodeIcon, 'size-6 text-muted-foreground')" />

    <TextTickerMultiLine
      class="shrink-0 h-7 w-full text-xs font-normal text-foreground leading-normal mt-2"
    >
      {{ node.label }}
    </TextTickerMultiLine>
  </div>

  <Teleport v-if="showPreview" to="body">
    <div
      :ref="(el) => (previewRef = el as HTMLElement)"
      :style="nodePreviewStyle"
    >
      <NodePreviewCard
        :node-def="node.data!"
        :show-inputs-and-outputs="false"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { kebabCase } from 'es-toolkit/string'
import type { Ref } from 'vue'
import { computed, inject } from 'vue'

import TextTickerMultiLine from '@/components/common/TextTickerMultiLine.vue'
import NodePreviewCard from '@/components/node/NodePreviewCard.vue'
import { useNodePreviewAndDrag } from '@/composables/node/useNodePreviewAndDrag'
import { ESSENTIALS_ICON_OVERRIDES } from '@/constants/essentialsNodes'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
import { cn } from '@/utils/tailwindUtil'

const { node } = defineProps<{
  node: RenderedTreeExplorerNode<ComfyNodeDefImpl>
}>()

const panelRef = inject<Ref<HTMLElement | null>>(
  'essentialsPanelRef',
  undefined!
)

const emit = defineEmits<{
  click: [node: RenderedTreeExplorerNode<ComfyNodeDefImpl>]
}>()

const nodeDef = computed(() => node.data)

const {
  previewRef,
  showPreview,
  nodePreviewStyle,
  handleMouseEnter,
  handleMouseLeave,
  handleDragStart,
  handleDragEnd
} = useNodePreviewAndDrag(nodeDef, panelRef)

const nodeIcon = computed(() => {
  const nodeName = node.data?.name
  if (nodeName && nodeName in ESSENTIALS_ICON_OVERRIDES)
    return ESSENTIALS_ICON_OVERRIDES[nodeName]
  const iconName = nodeName ? kebabCase(nodeName) : 'node'
  return `icon-[comfy--${iconName}]`
})

function handleClick() {
  if (!node.data) return
  emit('click', node)
}
</script>
