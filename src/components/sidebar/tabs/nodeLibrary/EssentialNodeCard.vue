<template>
  <div
    :class="
      cn(
        'flex flex-col items-center justify-center py-4 px-2 rounded-2xl cursor-pointer select-none transition-colors duration-150 box-content',
        'bg-component-node-background hover:bg-secondary-background-hover border border-component-node-border',
        'aspect-square'
      )
    "
    :data-node-name="nodeDef?.display_name"
    draggable="true"
    @click="handleClick"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div class="flex flex-1 items-center justify-center">
      <i :class="cn(nodeIcon, 'size-14 text-muted-foreground')" />
    </div>
    <span
      class="shrink-0 h-8 text-sm font-bold text-center text-foreground line-clamp-2 leading-4"
    >
      {{ nodeDef?.display_name }}
    </span>
  </div>

  <Teleport v-if="showPreview" to="body">
    <div
      :ref="(el) => (previewRef = el as HTMLElement)"
      :style="nodePreviewStyle"
    >
      <NodePreviewCard :node-def="nodeDef!" :show-inputs-and-outputs="false" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { kebabCase } from 'es-toolkit/string'
import { computed, inject } from 'vue'

import NodePreviewCard from '@/components/node/NodePreviewCard.vue'
import { SidebarContainerKey } from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import { useNodePreviewAndDrag } from '@/composables/node/useNodePreviewAndDrag'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
import { cn } from '@/utils/tailwindUtil'

const { node } = defineProps<{
  node: RenderedTreeExplorerNode<ComfyNodeDefImpl>
}>()

const emit = defineEmits<{
  click: [node: RenderedTreeExplorerNode<ComfyNodeDefImpl>]
}>()

const nodeDef = computed(() => node.data)

const panelRef = inject(SidebarContainerKey, undefined)

const {
  previewRef,
  showPreview,
  nodePreviewStyle,
  handleMouseEnter,
  handleMouseLeave,
  handleDragStart,
  handleDragEnd
} = useNodePreviewAndDrag(nodeDef, { panelRef })

const nodeIcon = computed(() => {
  const nodeName = nodeDef.value?.name
  const iconName = nodeName ? kebabCase(nodeName) : 'node'
  return `icon-[comfy--${iconName}]`
})

function handleClick() {
  if (!nodeDef.value) return
  emit('click', node)
}
</script>
