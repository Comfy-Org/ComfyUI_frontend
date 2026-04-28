<script setup lang="ts">
/**
 * InputCell — layout cell hosting a single selected input widget.
 *
 * One cell per selected input. Body rendering mirrors AppModeWidgetList's
 * per-widget block (header row with label + subtitle, then DropZone +
 * NodeWidgets with the Tailwind classes that force full-width widget
 * layout) — no custom scoped CSS fighting NodeWidgets internals.
 *
 * The `variant` prop toggles edit affordances.
 *
 * - `app-mode` is the runtime view — widgets are live, the label is a
 *   plain span, no editing path.
 *
 * - `builder` makes the widget body inert (so preview inputs can't be
 *   typed into while arranging) and makes the label double-click
 *   editable via EditableText. Rename on commit runs through the same
 *   `renameWidget` helper the pre-PR ⋯ menu used. Zero visible UI
 *   difference from App Mode when not editing — the two variants share
 *   the same layout so WYSIWYG holds. Discoverability tradeoff:
 *   dblclick isn't signposted. Rename is a power-user move, and
 *   clicking-a-title-to-rename is the pattern most authors already
 *   reach for.
 *
 * To remove a picked input, deselect the widget on the graph canvas
 * (click it again in the Inputs step). Keeping removal on the canvas
 * instead of in a panel ⋯ menu avoids panel-only chrome.
 *
 * Arbitrary variants on the body wrapper override NodeWidgets' internal
 * text-xs type scale to the layout scale, and let multiline textareas
 * fill the cell body without their own min-height / resize-y overrides.
 */
import { cn } from '@comfyorg/tailwind-utils'
import { provide, ref } from 'vue'

import EditableText from '@/components/common/EditableText.vue'
import type { extractVueNodeData } from '@/composables/graph/useGraphNodeManager'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import DropZone from '@/renderer/extensions/linearMode/DropZone.vue'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import { HideInputSelectionKey, HideLayoutFieldKey } from '@/types/widgetTypes'
import { friendlyNodeLabel } from '@/utils/nodeTitleUtil'
import { renameWidget } from '@/utils/widgetUtil'

export interface InputCellEntry {
  key: string
  /** Filtered nodeData containing only this widget */
  nodeData: ReturnType<typeof extractVueNodeData>
  /** The underlying LG widget, kept around for actions (rename/remove) in later phases */
  widget: IBaseWidget
  /** Owning graph node, kept around for actions in later phases */
  node: LGraphNode
}

export type InputCellVariant = 'app-mode' | 'builder'

const { entry, variant = 'app-mode' } = defineProps<{
  entry: InputCellEntry
  variant?: InputCellVariant
}>()

const isEditingLabel = ref(false)

// Hide each widget's internal label — InputCell renders one label per
// cell in the header, so NodeWidgets' internal label is redundant.
provide(HideLayoutFieldKey, true)
// Hide AppInput's linear-mode selection checkbox. The panel shows the
// already-picked inputs; checking/unchecking in the panel just mirrors
// graph-side selection and breaks WYSIWYG. Removal stays on the graph
// canvas (click the picked widget again to deselect).
provide(HideInputSelectionKey, true)

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
  <!-- gap-2.5 (10px) matches panel-block-list's block-to-block gap so
       vertical rhythm stays uniform: label→input == input→next-label. -->
  <div class="box-border flex size-full min-h-0 min-w-0 flex-col gap-2.5">
    <div class="flex min-h-4 shrink-0 items-center gap-1">
      <!-- Builder: label is dblclick-editable (power-user rename path).
           app-mode: plain span, identical layout. EditableText renders
           a plain span when not editing so the two paths paint
           identically pixel-for-pixel. -->
      <EditableText
        :model-value="entry.widget.label || entry.widget.name"
        :is-editing="isEditingLabel"
        :class="
          cn(
            'min-w-0 truncate text-layout-md text-layout-text',
            variant === 'builder' && 'cursor-text'
          )
        "
        label-type="span"
        @dblclick="startEditing"
        @edit="commitRename"
        @cancel="cancelRename"
      />
      <!-- Node-title subtitle so users can disambiguate widgets that
           share a label (e.g. two "text" inputs from positive + negative
           prompt nodes). friendlyNodeLabel strips the technical node
           class name — "CLIP Text Encode (Positive Prompt)" becomes
           "Positive Prompt". Same base size as the label; color alone
           creates hierarchy. -->
      <span class="flex-1 truncate text-right text-layout-md text-layout-mute">
        {{ friendlyNodeLabel(entry.node.title) }}
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
/* Body-scoped overrides for NodeWidgets internals — consolidates what
   used to be five Tailwind `[&_input]:…!` / `[&_textarea]:…!` arbitrary
   variants on the wrapper into one place. The `!important` matches the
   pattern in PanelBlockList: NodeWidgets sets these properties via its
   own utility classes, and without `!important` the design-system
   defaults win the cascade. The proper fix is a layout prop/variant on
   NodeWidgets itself (CR feedback) — out of scope for this PR. */
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
