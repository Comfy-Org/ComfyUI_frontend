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
    <TextTickerMultiLine
      class="text-foreground flex h-[30px] w-full shrink-0 flex-col justify-center px-2 text-center text-xs/[15px] font-normal @[112px]:h-[36px] @[112px]:text-sm/[18px]"
      :text="tile.label"
    />
  </div>

  <Teleport v-if="showPreview && nodeDef" to="body">
    <div ref="previewRef" :style="nodePreviewStyle">
      <NodePreviewCard :node-def :show-inputs-and-outputs="false" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
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

const {
  previewRef,
  showPreview,
  nodePreviewStyle,
  handleMouseEnter,
  handleMouseLeave,
  handleDragStart,
  handleDragEnd
} = useNodePreviewAndDrag(nodeDef, () => previewPanel ?? null)
void previewRef // typechecker is wrong
</script>
