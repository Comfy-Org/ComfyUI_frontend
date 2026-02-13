<template>
  <div
    :class="
      cn(
        'flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer select-none transition-colors duration-150',
        'bg-neutral-800 hover:bg-neutral-700',
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
      <i :class="cn(nodeIcon, 'size-10 text-neutral-400')" />
    </div>
    <span
      class="shrink-0 h-8 text-xs font-medium text-center text-neutral-200 line-clamp-2 leading-4"
    >
      {{ nodeDef?.display_name }}
    </span>
  </div>

  <Teleport v-if="showPreview" to="body">
    <div
      :ref="(el) => (previewRef = el as HTMLElement)"
      :style="nodePreviewStyle"
    >
      <NodePreviewCard :node-def="nodeDef!" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { kebabCase } from 'es-toolkit/string'
import { computed } from 'vue'

import NodePreviewCard from '@/components/node/NodePreviewCard.vue'
import { useNodePreviewAndDrag } from '@/composables/node/useNodePreviewAndDrag'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
import { cn } from '@/utils/tailwindUtil'

const props = defineProps<{
  node: RenderedTreeExplorerNode<ComfyNodeDefImpl>
}>()

const emit = defineEmits<{
  click: [node: RenderedTreeExplorerNode<ComfyNodeDefImpl>]
}>()

const nodeDef = computed(() => props.node.data)

const {
  previewRef,
  showPreview,
  nodePreviewStyle,
  handleMouseEnter,
  handleMouseLeave,
  handleDragStart,
  handleDragEnd
} = useNodePreviewAndDrag(nodeDef)

const nodeIcon = computed(() => {
  const nodeName = nodeDef.value?.name
  const iconName = nodeName ? kebabCase(nodeName) : 'node'
  return `icon-[comfy--${iconName}]`
})

function handleClick() {
  if (!nodeDef.value) return
  emit('click', props.node)
}
</script>
