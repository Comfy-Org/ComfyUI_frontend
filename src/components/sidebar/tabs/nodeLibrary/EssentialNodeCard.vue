<template>
  <div
    :class="
      cn(
        'group @container relative flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg bg-secondary-background pt-3 pb-2 transition-colors duration-150 select-none hover:bg-secondary-background-hover',
        nodeDef ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      )
    "
    :data-node-name="tile.nodeName"
    :draggable="nodeDef != null"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @click="nodeDef && useNodeDragToCanvas().startDrag(nodeDef)"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
  >
    <i :class="cn('size-7 text-muted-foreground', tile.icon)" />
    <span
      v-if="tile.partnerLogo"
      aria-hidden="true"
      class="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-md bg-base-background"
    >
      <i :class="cn('size-4 text-smoke-600', tile.partnerLogo)" />
    </span>
    <TextTickerMultiLine
      class="text-foreground @28:h-9 @28:text-sm/4.5 flex h-7.5 w-full shrink-0 flex-col justify-center px-2 text-center text-xs/3.75 font-normal"
      :text="nodeDef?.display_name ?? tile.nodeName"
    />
  </div>

  <Teleport v-if="showPreview && nodeDef" to="body">
    <div ref="previewRef" :style="nodePreviewStyle">
      <NodePreviewCard :node-def :show-inputs-and-outputs="false" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'

import TextTickerMultiLine from '@/components/common/TextTickerMultiLine.vue'
import NodePreviewCard from '@/components/node/NodePreviewCard.vue'
import { useNodeDragToCanvas } from '@/composables/node/useNodeDragToCanvas'
import { useNodePreviewAndDrag } from '@/composables/node/useNodePreviewAndDrag'
import { useEssentialTileNodeDef } from '@/composables/useEssentialTileNodeDef'
import type { EssentialTile } from '@/constants/essentialsNodes'
import { cn } from '@comfyorg/tailwind-utils'

const { previewPanel, tile } = defineProps<{
  tile: EssentialTile
  previewPanel?: HTMLElement | null
}>()
const nodeDef = useEssentialTileNodeDef(() => tile)
const previewRef = useTemplateRef('previewRef')

const {
  showPreview,
  nodePreviewStyle,
  handleMouseEnter,
  handleMouseLeave,
  handleDragStart,
  handleDragEnd
} = useNodePreviewAndDrag(nodeDef, previewRef, () => previewPanel ?? null)
</script>
