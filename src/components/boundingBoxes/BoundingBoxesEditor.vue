<template>
  <div
    :class="cn('flex select-none', layout.root)"
    data-testid="bounding-boxes"
    @pointerdown.stop
  >
    <div :class="cn('flex', layout.stage)">
      <Teleport
        defer
        :to="`#${BOUNDING_BOXES_HEADER_ACTIONS_ID}`"
        :disabled="!fullscreen"
      >
        <div :class="cn('flex items-center gap-1', layout.toolbar)">
          <Button
            variant="textonly"
            size="unset"
            :aria-pressed="grid"
            :class="
              cn('shrink-0 gap-1.5 rounded-md px-2 py-1', grid && 'bg-muted')
            "
            @click="grid = !grid"
          >
            <i class="icon-[lucide--grid-3x3]" />
            <span>{{ $t('boundingBoxes.grid') }}</span>
          </Button>
          <WidgetHistoryButtons
            class="ml-auto"
            :can-undo
            :can-redo
            @undo="undo"
            @redo="redo"
          />
          <Button
            variant="textonly"
            size="unset"
            :class="actionBtnClass"
            @click="clearAll"
          >
            <i class="icon-[lucide--trash-2]" />
            <span>{{ $t('boundingBoxes.clearAll') }}</span>
          </Button>
          <slot name="toolbar-end" />
        </div>
      </Teleport>
      <div
        :class="
          cn('relative shrink-0 overflow-hidden bg-background', layout.canvas)
        "
        :style="fullscreen ? containedCanvasStyle : canvasStyle"
      >
        <canvas
          ref="canvasEl"
          tabindex="0"
          class="absolute inset-0 size-full rounded-sm outline-none"
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
          class="absolute resize-none rounded-sm border-2 bg-black/90 p-1 font-mono text-xs text-white outline-none"
          :style="inlineEditor.style"
          data-capture-wheel="true"
          @keydown.stop="onInlineKeyDown"
          @blur="commitInlineEditor"
        />
      </div>
    </div>

    <div
      v-if="fullscreen"
      class="flex w-80 shrink-0 flex-col overflow-y-auto border-l bg-background p-3"
    >
      <BoundingBoxesRegionList
        v-if="hasRegions"
        :regions="regions"
        :active-index="activeIndex"
        :max-colors="maxColors"
        @select="selectRegion"
        @delete="deleteRegion"
        @update:type="(index, type) => updateRegion(index, 'type', type)"
        @update:text="(index, text) => updateRegion(index, 'text', text)"
        @update:desc="(index, desc) => updateRegion(index, 'desc', desc)"
        @update:palette="
          (index, palette) => updateRegion(index, 'palette', palette)
        "
      />
      <div v-else class="px-1 text-muted-foreground">
        {{ $t('boundingBoxes.drawRegionHint') }}
      </div>
    </div>
    <template v-else>
      <BoundingBoxesRegionForm
        v-if="activeRegion"
        :region="activeRegion"
        :max-colors="maxColors"
        @update:type="updateRegion(activeIndex, 'type', $event)"
        @update:text="updateRegion(activeIndex, 'text', $event)"
        @update:desc="updateRegion(activeIndex, 'desc', $event)"
        @update:palette="updateRegion(activeIndex, 'palette', $event)"
      />
      <div v-else-if="hasRegions" class="px-1 text-muted-foreground">
        {{ $t('boundingBoxes.clickRegionToEdit') }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import BoundingBoxesRegionForm from '@/components/boundingBoxes/BoundingBoxesRegionForm.vue'
import BoundingBoxesRegionList from '@/components/boundingBoxes/BoundingBoxesRegionList.vue'
import { BOUNDING_BOXES_HEADER_ACTIONS_ID } from '@/components/boundingBoxes/boundingBoxesHeaderActionsId'
import Button from '@comfyorg/design-system/button/Button'
import WidgetHistoryButtons from '@/components/widgetHistory/WidgetHistoryButtons.vue'
import { useBoundingBoxes } from '@/composables/boundingBoxes/useBoundingBoxes'
import type { BoundingBox } from '@/types/boundingBoxes'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const layouts = {
  inline: {
    root: 'widget-expands size-full flex-col gap-1',
    stage: 'flex-col',
    toolbar:
      'h-9 rounded-t-sm border border-b-0 border-node-border bg-input px-2',
    canvas: 'w-full rounded-b-sm border border-t-0 border-node-border'
  },
  fullscreen: {
    root: 'min-h-0 flex-1',
    stage: '@container-size min-w-0 flex-1 items-center justify-center p-4',
    toolbar: '',
    canvas: 'rounded-sm border border-node-border'
  }
}

const actionBtnClass =
  'flex shrink-0 items-center gap-1.5 rounded-md border-0 bg-transparent px-2 py-1 text-sm text-foreground outline-none transition-colors hover:bg-muted'

const {
  nodeId,
  widget,
  fullscreen = false
} = defineProps<{
  nodeId: NodeId
  widget: SimplifiedWidget
  fullscreen?: boolean
}>()
const modelValue = defineModel<BoundingBox[]>({ default: () => [] })
const layout = fullscreen ? layouts.fullscreen : layouts.inline

const canvasEl = useTemplateRef<HTMLCanvasElement>('canvasEl')
const inlineEditorEl = useTemplateRef<HTMLTextAreaElement>('inlineEditorEl')

const {
  canvasStyle,
  containedCanvasStyle,
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
  regions,
  activeIndex,
  selectRegion,
  deleteRegion,
  updateRegion,
  clearAll,
  canUndo,
  canRedo,
  undo,
  redo,
  grid
} = useBoundingBoxes(nodeId, {
  canvasEl,
  inlineEditorEl,
  modelValue,
  widget,
  alwaysShowActive: fullscreen
})
</script>
