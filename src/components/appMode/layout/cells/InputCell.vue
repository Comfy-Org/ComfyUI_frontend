<script setup lang="ts">
/**
 * InputCell — layout cell hosting a single selected input widget.
 *
 * Phase 2a: each selected input becomes its own cell. Rendering mirrors
 * AppModeWidgetList's per-widget block exactly (header row with label,
 * then DropZone + NodeWidgets with the specific Tailwind classes that
 * force full-width widget layout) — no custom scoped CSS fighting
 * NodeWidgets internals.
 *
 * Arbitrary variants on the body wrapper override NodeWidgets' internal
 * text-xs type scale to the layout scale, and let multiline textareas
 * fill the cell body without their own min-height / resize-y overrides.
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
  <!-- gap-2.5 (10px) matches panel-block-list's block-to-block gap so
       vertical rhythm stays uniform: label→input == input→next-label. -->
  <div class="box-border flex size-full min-h-0 min-w-0 flex-col gap-2.5">
    <div class="flex min-h-4 shrink-0 items-center gap-1">
      <span class="truncate text-layout-md text-layout-text">
        {{ entry.widget.label || entry.widget.name }}
      </span>
      <!-- Node-title subtitle so users can disambiguate widgets that
           share a label (e.g. two "text" inputs from positive + negative
           prompt nodes). Strips the technical node class name via
           friendlyNodeLabel — "CLIP Text Encode (Positive Prompt)"
           becomes "Positive Prompt". Matches AppModeWidgetList. Subtitle
           shares the label's size; color alone creates hierarchy. -->
      <span class="flex-1 truncate text-right text-layout-md text-layout-mute">
        {{ friendlyNodeLabel(entry.node.title) }}
      </span>
    </div>
    <div
      class="min-h-0 flex-1 overflow-hidden [&_input]:text-layout-md! [&_textarea]:h-full! [&_textarea]:min-h-0! [&_textarea]:resize-none! [&_textarea]:text-layout-md!"
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
