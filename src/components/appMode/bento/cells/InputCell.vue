<script setup lang="ts">
/**
 * InputCell — bento cell hosting a single selected input widget.
 *
 * Phase 2a: each selected input becomes its own cell. Rendering mirrors
 * AppModeWidgetList's per-widget block exactly (header row with label,
 * then DropZone + NodeWidgets with the specific Tailwind classes that
 * force full-width widget layout) — no custom scoped CSS fighting
 * NodeWidgets internals.
 */
import { provide } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { extractVueNodeData } from '@/composables/graph/useGraphNodeManager'

import DropZone from '@/renderer/extensions/linearMode/DropZone.vue'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import { HideLayoutFieldKey } from '@/types/widgetTypes'

export interface InputCellEntry {
  key: string
  /** Filtered nodeData containing only this widget */
  nodeData: ReturnType<typeof extractVueNodeData>
  /** The underlying LG widget, kept around for actions (rename/remove) in later phases */
  widget: IBaseWidget
  /** Owning graph node, kept around for actions in later phases */
  node: LGraphNode
}

defineProps<{
  entry: InputCellEntry
}>()

// Hide each widget's internal label — AppModeWidgetList shows one label
// per cell in the header and we do the same.
provide(HideLayoutFieldKey, true)
</script>

<template>
  <div class="input-cell">
    <div class="input-cell__header">
      <span class="input-cell__label">
        {{ entry.widget.label || entry.widget.name }}
      </span>
    </div>
    <div class="input-cell__body">
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
.input-cell {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  padding: 6px 12px 10px;
  box-sizing: border-box;
}

.input-cell__header {
  flex-shrink: 0;
  display: flex;
  min-height: 32px;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
}

.input-cell__label {
  font-size: var(--bento-font-md);
  color: var(--bento-color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.input-cell__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Widget content (textareas, inputs, dropdowns) normally renders at
   text-xs via WidgetTextarea/WidgetInputNumber. Override to the
   default bento scale. */
.input-cell__body :deep(textarea),
.input-cell__body :deep(input) {
  font-size: var(--bento-font-md) !important;
}

/* Let multiline textareas fill the cell body. */
.input-cell__body :deep(textarea) {
  height: 100% !important;
  min-height: 0 !important;
  resize: none !important;
}
</style>
