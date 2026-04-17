<script setup lang="ts">
/**
 * InputCell — layout cell hosting a single selected input widget.
 *
 * Phase 2a: each selected input becomes its own cell. Rendering mirrors
 * AppModeWidgetList's per-widget block exactly (header row with label,
 * then DropZone + NodeWidgets with the specific Tailwind classes that
 * force full-width widget layout) — no custom scoped CSS fighting
 * NodeWidgets internals.
 */
import { provide } from 'vue'

import type { extractVueNodeData } from '@/composables/graph/useGraphNodeManager'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import DropZone from '@/renderer/extensions/linearMode/DropZone.vue'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import { HideLayoutFieldKey } from '@/types/widgetTypes'
import { friendlyNodeLabel } from '@/utils/nodeTitleUtil'

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
      <!-- Node-title subtitle so users can disambiguate widgets that
           share a label (e.g. two "text" inputs from positive + negative
           prompt nodes). Strips the technical node class name via
           friendlyNodeLabel — "CLIP Text Encode (Positive Prompt)"
           becomes "Positive Prompt". Matches AppModeWidgetList. -->
      <span class="input-cell__subtitle">
        {{ friendlyNodeLabel(entry.node.title) }}
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
  /* Matches the 10px gap between blocks (panel-block-list) so vertical
     rhythm stays consistent: label→input equals input→next-label. */
  gap: 10px;
  box-sizing: border-box;
}

.input-cell__header {
  flex-shrink: 0;
  display: flex;
  min-height: 16px;
  align-items: center;
  gap: 4px;
  padding: 0;
}

.input-cell__label {
  font-size: var(--layout-font-md);
  color: var(--layout-color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Subtitle shares the label's base size; color alone (muted vs. primary)
   creates the hierarchy. Same treatment used by AppModeWidgetList so
   both rendering paths read identically. */
.input-cell__subtitle {
  flex: 1;
  min-width: 0;
  font-size: var(--layout-font-md);
  color: var(--layout-color-text-muted);
  text-align: right;
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
   default layout scale. */
.input-cell__body :deep(textarea),
.input-cell__body :deep(input) {
  font-size: var(--layout-font-md) !important;
}

/* Let multiline textareas fill the cell body. */
.input-cell__body :deep(textarea) {
  height: 100% !important;
  min-height: 0 !important;
  resize: none !important;
}
</style>
