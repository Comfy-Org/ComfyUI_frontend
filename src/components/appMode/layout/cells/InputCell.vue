<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { provide, ref } from 'vue'

import EditableText from '@/components/common/EditableText.vue'
import type { extractVueNodeData } from '@/composables/graph/useGraphNodeManager'
import { OverlayAppendToKey } from '@/composables/useTransformCompatOverlayProps'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import DropZone from '@/renderer/extensions/linearMode/DropZone.vue'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import { HideInputSelectionKey, HideLayoutFieldKey } from '@/types/widgetTypes'
import { renameWidget } from '@/utils/widgetUtil'

export interface InputCellEntry {
  key: string
  /** Filtered nodeData containing only this widget. */
  nodeData: ReturnType<typeof extractVueNodeData>
  widget: IBaseWidget
  node: LGraphNode
  /** Type/semantic descriptor shown to the right of the input label.
   *  Computed by `widgetSubtitle()` against the simplified widget. */
  subtitle: string
}

export type InputCellVariant = 'app-mode' | 'builder'

const { entry, variant = 'app-mode' } = defineProps<{
  entry: InputCellEntry
  variant?: InputCellVariant
}>()

const isEditingLabel = ref(false)

// InputCell owns the label + selection chrome — hide the duplicates
// NodeWidgets / AppInput would otherwise render inside the cell.
provide(HideLayoutFieldKey, true)
provide(HideInputSelectionKey, true)
// Teleport Select / MultiSelect / dropdown overlays to <body> so the
// floating panel's `overflow: hidden` doesn't clip the option list.
// Default is 'self' (Vue node graph needs that for transform
// inheritance); the App Mode panel doesn't have a transform, so
// 'body' is the right call here.
provide(OverlayAppendToKey, 'body')

function startEditing() {
  if (variant !== 'builder') return
  isEditingLabel.value = true
}

function commitRename(next: string) {
  isEditingLabel.value = false
  const trimmed = next.trim()
  if (!trimmed) return
  const current = entry.widget.label ?? entry.widget.name
  if (trimmed === current) return
  renameWidget(entry.widget, entry.node, trimmed)
}

function cancelRename() {
  isEditingLabel.value = false
}
</script>

<template>
  <div class="box-border flex size-full min-h-0 min-w-0 flex-col gap-2.5">
    <!-- px-1.5 matches widget text inset so label aligns with input. -->
    <div class="flex min-h-4 shrink-0 items-center gap-1 px-1.5">
      <!-- Builder variant: dblclick-to-rename. app-mode: plain span. -->
      <!-- Label and subtitle share font-size + weight; hierarchy is
           by color (text vs mute), not by type scale. -->
      <EditableText
        :model-value="entry.widget.label || entry.widget.name"
        :is-editing="isEditingLabel"
        :class="
          cn(
            'min-w-0 truncate text-layout-md font-medium text-layout-text',
            variant === 'builder' && 'cursor-text'
          )
        "
        label-type="span"
        @dblclick="startEditing"
        @edit="commitRename"
        @cancel="cancelRename"
      />
      <!-- Type/semantic descriptor (text, number, size, seed, list, …). -->
      <span
        class="flex-1 truncate text-right text-layout-md font-medium text-layout-mute"
      >
        {{ entry.subtitle }}
      </span>
    </div>
    <div
      class="input-cell__body min-h-0 flex-1 overflow-hidden"
      :inert="variant === 'builder' || undefined"
    >
      <DropZone>
        <NodeWidgets
          :node-data="entry.nodeData"
          class="gap-y-3 rounded-lg py-1 [&_textarea]:resize-y **:[.col-span-2]:grid-cols-1 not-md:**:[.h-7]:h-10"
        />
      </DropZone>
    </div>
  </div>
</template>

<style scoped>
/* `!important` to win against NodeWidgets' own utility classes — the
   proper fix is a layout prop on NodeWidgets, follow-up to this PR. */
.input-cell__body :deep(input) {
  font-size: var(--text-layout-md) !important;
}
.input-cell__body :deep(textarea) {
  height: 100% !important;
  min-height: 0 !important;
  resize: none !important;
  font-size: var(--text-layout-md) !important;
}
</style>
