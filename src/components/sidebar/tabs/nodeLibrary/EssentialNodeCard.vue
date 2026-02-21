<template>
  <div
    :class="
      cn(
        'essential-node-card relative flex flex-col items-center justify-center py-4 px-2 rounded-2xl cursor-pointer select-none transition-colors duration-150 box-content',
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

    <!-- Hidden measurement span for line-break detection -->
    <span
      ref="measureRef"
      class="invisible absolute inset-x-0 top-0 pointer-events-none px-2 text-xs font-bold leading-4"
      aria-hidden="true"
    >
      {{ nodeDef?.display_name }}
    </span>

    <!-- Single line (text fits without wrapping) -->
    <span
      v-if="!secondLine"
      class="shrink-0 h-8 flex items-center text-xs font-bold text-center text-foreground leading-3"
    >
      {{ nodeDef?.display_name }}
    </span>

    <!-- Two lines: static first line + marquee second line -->
    <div v-else class="shrink-0 h-9 w-full flex flex-col justify-center">
      <div class="marquee-container w-full overflow-hidden h-[18px]">
        <span
          class="marquee-text inline-block whitespace-nowrap text-xs font-bold text-foreground leading-3 min-w-full text-center"
        >
          {{ firstLine }}
        </span>
      </div>
      <div class="marquee-container w-full overflow-hidden h-[18px]">
        <span
          class="marquee-text inline-block whitespace-nowrap text-xs font-bold text-foreground leading-3 min-w-full text-center"
        >
          {{ secondLine }}
        </span>
      </div>
    </div>
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
import { useResizeObserver } from '@vueuse/core'
import { kebabCase } from 'es-toolkit/string'
import { computed, inject, nextTick, ref, watch } from 'vue'

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

const measureRef = ref<HTMLElement | null>(null)
const firstLine = ref('')
const secondLine = ref('')

function splitLines() {
  const el = measureRef.value
  const text = nodeDef.value?.display_name
  if (!el || !text) {
    firstLine.value = ''
    secondLine.value = ''
    return
  }

  const textNode = el.firstChild
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
    firstLine.value = text
    secondLine.value = ''
    return
  }

  const range = document.createRange()
  range.selectNodeContents(textNode)
  const rects = range.getClientRects()

  if (rects.length <= 1) {
    firstLine.value = text
    secondLine.value = ''
    return
  }

  const firstRectBottom = rects[0].bottom
  let splitIndex = text.length
  let low = 1
  let high = text.length - 1

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    range.setStart(textNode, mid)
    range.setEnd(textNode, mid + 1)
    const charRect = range.getBoundingClientRect()
    if (charRect.top >= firstRectBottom - 1) {
      splitIndex = mid
      high = mid - 1
    } else {
      low = mid + 1
    }
  }

  if (splitIndex < text.length) {
    firstLine.value = text.substring(0, splitIndex).trim()
    secondLine.value = text.substring(splitIndex).trim()
  } else {
    firstLine.value = text
    secondLine.value = ''
  }
}

useResizeObserver(measureRef, splitLines)

watch(
  () => nodeDef.value?.display_name,
  async () => {
    await nextTick()
    splitLines()
  }
)
</script>
