<template>
  <div
    class="widget-expands flex size-full flex-col gap-1 select-none"
    data-testid="bounding-boxes"
    @pointerdown.stop
  >
    <div class="flex flex-col">
      <div
        class="flex h-9 items-center gap-1 rounded-t-sm border border-b-0 border-component-node-border bg-component-node-widget-background px-2"
      >
        <Button
          variant="textonly"
          size="unset"
          :aria-pressed="grid"
          :class="
            cn(
              actionBtnClass,
              grid && 'bg-component-node-widget-background-selected'
            )
          "
          @click="grid = !grid"
        >
          <i class="icon-[lucide--grid-3x3] size-4" />
          <span>{{ $t('boundingBoxes.grid') }}</span>
        </Button>
        <Button
          variant="textonly"
          size="unset"
          :class="cn(actionBtnClass, 'ml-auto')"
          @click="clearAll"
        >
          <i class="icon-[lucide--undo-2] size-4" />
          <span>{{ $t('boundingBoxes.clearAll') }}</span>
        </Button>
      </div>
      <div
        ref="canvasContainer"
        class="relative w-full shrink-0 overflow-hidden rounded-b-sm border border-t-0 border-component-node-border bg-base-background"
        :style="canvasStyle"
      >
        <canvas
          ref="canvasEl"
          tabindex="0"
          class="absolute inset-0 size-full rounded-sm text-node-component-slot-text outline-none"
          :style="{ cursor: canvasCursor }"
          @pointerdown="onPointerDown"
          @pointermove="onCanvasPointerMove"
          @pointerup="onDocPointerUp"
          @pointercancel="onDocPointerUp"
          @pointerleave="onPointerLeave"
          @lostpointercapture="onDocPointerUp"
          @dblclick="onDoubleClick"
          @keydown="onCanvasKeyDown"
          @focus="focused = true"
          @blur="focused = false"
        />
        <textarea
          v-if="inlineEditor"
          ref="inlineEditorEl"
          v-model="inlineEditor.value"
          class="absolute box-border resize-none rounded-sm border-2 bg-black/90 p-1 font-mono text-xs text-white outline-none"
          :style="inlineEditor.style"
          data-capture-wheel="true"
          @keydown.stop="onInlineKeyDown"
          @blur="commitInlineEditor"
        />
      </div>
    </div>

    <div
      v-if="activeRegion"
      class="flex flex-col gap-2 rounded-sm bg-node-component-surface p-2 text-xs"
    >
      <div
        class="flex h-8 items-center gap-1 rounded-sm bg-component-node-widget-background p-1"
      >
        <Button
          variant="textonly"
          size="unset"
          :class="
            cn(
              'flex-1 self-stretch px-2 text-xs transition-colors',
              activeRegion.type === 'obj'
                ? 'rounded-sm bg-component-node-widget-background-selected text-base-foreground'
                : 'text-node-text-muted hover:text-node-text'
            )
          "
          @click="setActiveType('obj')"
        >
          {{ $t('boundingBoxes.typeObj') }}
        </Button>
        <Button
          variant="textonly"
          size="unset"
          :class="
            cn(
              'flex-1 self-stretch px-2 text-xs transition-colors',
              activeRegion.type === 'text'
                ? 'rounded-sm bg-component-node-widget-background-selected text-base-foreground'
                : 'text-node-text-muted hover:text-node-text'
            )
          "
          @click="setActiveType('text')"
        >
          {{ $t('boundingBoxes.typeText') }}
        </Button>
      </div>
      <div
        v-if="activeRegion.type === 'text'"
        class="group relative rounded-lg transition-all focus-within:ring focus-within:ring-component-node-widget-background-highlighted hover:bg-component-node-widget-background-hovered"
      >
        <span
          class="pointer-events-none absolute top-1.5 left-3 z-10 text-2xs text-muted-foreground"
        >
          {{ $t('boundingBoxes.textLabel') }}
        </span>
        <Textarea
          v-model="activeRegion.text"
          :placeholder="$t('boundingBoxes.textPlaceholder')"
          class="min-h-14 resize-none overflow-hidden pt-5 text-(length:--comfy-textarea-font-size) leading-normal not-disabled:bg-component-node-widget-background not-disabled:text-component-node-foreground hover:overflow-auto focus:overflow-auto"
          data-capture-wheel="true"
          @update:model-value="syncState"
        />
      </div>
      <div
        class="group relative rounded-lg transition-all focus-within:ring focus-within:ring-component-node-widget-background-highlighted hover:bg-component-node-widget-background-hovered"
      >
        <span
          class="pointer-events-none absolute top-1.5 left-3 z-10 text-2xs text-muted-foreground"
        >
          {{ $t('boundingBoxes.descLabel') }}
        </span>
        <Textarea
          v-model="activeRegion.desc"
          :placeholder="$t('boundingBoxes.descPlaceholder')"
          class="min-h-20 resize-none overflow-hidden pt-5 text-(length:--comfy-textarea-font-size) leading-normal not-disabled:bg-component-node-widget-background not-disabled:text-component-node-foreground hover:overflow-auto focus:overflow-auto"
          data-capture-wheel="true"
          @update:model-value="syncState"
        />
      </div>
      <div class="flex items-center gap-2">
        <span class="shrink-0 truncate text-sm text-muted-foreground">
          {{ $t('boundingBoxes.colors') }}
        </span>
        <PaletteSwatchRow
          v-model="activeRegion.palette"
          :max="maxColors"
          @update:model-value="syncState"
        />
      </div>
    </div>
    <div v-else-if="hasRegions" class="text-node-text-muted px-1 text-xs">
      {{ $t('boundingBoxes.clickRegionToEdit') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import PaletteSwatchRow from '@/components/palette/PaletteSwatchRow.vue'
import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { useBoundingBoxes } from '@/composables/boundingBoxes/useBoundingBoxes'
import type { BoundingBox } from '@/types/boundingBoxes'
import type { NodeId } from '@/types/nodeId'

const actionBtnClass =
  'flex shrink-0 items-center gap-1.5 rounded-md border-0 bg-transparent px-2 py-1 text-sm text-base-foreground outline-none transition-colors hover:bg-component-node-widget-background-hovered'

const { nodeId } = defineProps<{ nodeId: NodeId }>()
const modelValue = defineModel<BoundingBox[]>({ default: () => [] })

const canvasEl = useTemplateRef<HTMLCanvasElement>('canvasEl')
const canvasContainer = useTemplateRef<HTMLDivElement>('canvasContainer')
const inlineEditorEl = useTemplateRef<HTMLTextAreaElement>('inlineEditorEl')

const {
  canvasStyle,
  canvasCursor,
  focused,
  activeRegion,
  hasRegions,
  inlineEditor,
  maxColors,
  onPointerDown,
  onCanvasPointerMove,
  onDocPointerUp,
  onPointerLeave,
  onDoubleClick,
  onCanvasKeyDown,
  onInlineKeyDown,
  commitInlineEditor,
  setActiveType,
  clearAll,
  syncState,
  grid
} = useBoundingBoxes(nodeId, {
  canvasEl,
  canvasContainer,
  inlineEditorEl,
  modelValue
})
</script>
