<script setup lang="ts">
/**
 * PanelBlockList — 2D grid of blocks inside a FloatingPanel.
 *
 * Rows stack vertically; within a row, blocks sit side-by-side. A
 * grip handle on each block's left edge drives pointer reorder via
 * useBlockDrag. During drag, the layout reshuffles to preview the
 * post-drop arrangement with a dashed outline on the moving block.
 */
import { cn } from '@comfyorg/tailwind-utils'
import { computed, useTemplateRef } from 'vue'

import InputCell from '../cells/InputCell.vue'
import type { InputCellEntry, InputCellVariant } from '../cells/InputCell.vue'
import type { BlockPos, BlockRow, DropTarget } from './panelTypes'
import { applyMove } from './useAppPanelLayout'
import { useBlockDrag } from './useBlockDrag'

const { rows, variant = 'app-mode' } = defineProps<{
  rows: BlockRow[]
  inputEntryMap: Map<string, InputCellEntry>
  /** Forwarded to InputCell — `builder` adds the ⋯ Rename/Remove menu
   *  and makes the widget body inert. */
  variant?: InputCellVariant
}>()

const emit = defineEmits<{
  reorder: [from: BlockPos, target: DropTarget]
}>()

const listEl = useTemplateRef<HTMLElement>('listEl')

const { draggingPos, dropTarget, startDrag } = useBlockDrag({
  listEl,
  onCommit: (from, target) => emit('reorder', from, target)
})

// id of the block in flight — used to flag it in the displayed rows
// and apply the dashed-outline preview styling.
const draggingBlockId = computed<string | null>(() => {
  const pos = draggingPos.value
  if (!pos) return null
  return rows[pos.row]?.[pos.col]?.id ?? null
})

// Rows rendered during drag: if there's an active drag target, show
// the layout exactly as it would look after the drop (via `applyMove`,
// the same math the commit uses). Otherwise render the stored rows
// unchanged. Drop-target math in useBlockDrag reads the DOM's
// data-block-row/col, which we keep in ORIGINAL coordinates below.
const displayRows = computed<BlockRow[]>(() => {
  const pos = draggingPos.value
  const target = dropTarget.value
  if (!pos || !target) return rows
  return applyMove(rows, pos, target)
})

// Map of block id → original (row, col) in `rows`. Lets each block's
// data-block-row/col attribute reflect its pre-drag position even
// when the block has been visually relocated by the preview layout —
// so `useBlockDrag` returns drop targets in the coordinate space
// `applyMove` and the commit path expect.
const originalById = computed(() => {
  const map = new Map<string, BlockPos>()
  rows.forEach((row, ri) =>
    row.forEach((b, ci) => map.set(b.id, { row: ri, col: ci }))
  )
  return map
})

// Look up the block's original position and start a drag from there.
// `originalById` is built from `rows` and every block in `displayRows`
// is a re-reference from `rows`, so a missing entry means the block
// isn't ours to drag — skip silently rather than invent coords.
function beginDrag(blockId: string, event: PointerEvent) {
  const pos = originalById.value.get(blockId)
  if (pos) startDrag(pos, event)
}
</script>

<template>
  <!--
    During drag, `displayRows` shows the layout exactly as it would
    look after the drop (via `applyMove`). The block in flight lands
    at its proposed new position with a dashed orange outline framing
    the space it will occupy — no separate line indicator, so the user
    sees the real geometry instead of inferring it from a hairline.
    10px list gap matches InputCell's header→body gap so the vertical
    rhythm stays uniform across panel and cell.
  -->
  <ul
    ref="listEl"
    class="m-0 flex list-none flex-col gap-[10px] p-0"
    role="list"
  >
    <!-- 16px row gap matches the grip width — the grip fills the gap
         exactly, with 4px dots centered so there's 6px clear per side. -->
    <li
      v-for="(row, rowIdx) in displayRows"
      :key="`row-${rowIdx}-${row[0]?.id}`"
      class="flex min-w-0 flex-row items-stretch gap-4"
    >
      <div
        v-for="block in row"
        :key="block.id"
        :class="
          cn(
            'group relative block min-w-0 flex-1',
            'rounded-layout-cell bg-transparent',
            'duration-layout transition-opacity ease-layout',
            block.id === draggingBlockId &&
              'outline-2 outline-offset-2 outline-warning-background outline-dashed'
          )
        "
        :data-block-row="originalById.get(block.id)?.row"
        :data-block-col="originalById.get(block.id)?.col"
        :data-block-kind="block.kind"
        :data-dragging="block.id === draggingBlockId ? 'true' : undefined"
      >
        <!-- Grip is a pointer-only affordance — hidden from the tab
             order and screen readers until keyboard reorder
             (Enter/Space to grab, arrow keys to move, Enter to drop)
             lands as a follow-up. Was a focusable <button>, but
             tabbing to it did nothing, which is the focusable-but-
             inert antipattern. Absolutely positioned into the panel
             body's 16px left padding — grip's right edge touches the
             block's left edge so content gets full width and the
             panel reads with symmetric 16px margins. -->
        <span
          :class="
            cn(
              'absolute inset-y-0 -left-4 flex w-4 p-0',
              'items-center justify-center bg-transparent',
              'cursor-grab touch-none active:cursor-grabbing',
              'duration-layout opacity-0 transition-opacity ease-layout',
              'group-hover:opacity-70',
              block.id === draggingBlockId && 'opacity-70'
            )
          "
          aria-hidden="true"
          @pointerdown="beginDrag(block.id, $event)"
        >
          <span
            class="h-full w-1 bg-[radial-gradient(circle,var(--color-layout-mute)_1px,transparent_1.2px)] bg-size-[4px_4px] bg-repeat-y"
            aria-hidden="true"
          />
        </span>
        <div class="w-full min-w-0 overflow-hidden">
          <!-- 1-item v-for binds the Map lookup once into `entry`, then
               v-if narrows to non-undefined so InputCell's :entry is
               correctly typed without a ! assertion. `entry?.key`
               satisfies vue/valid-v-for (key must derive from the
               iteration variable) while falling back to a stable
               string when the lookup misses. -->
          <template
            v-for="entry in [inputEntryMap.get(block.entryKey)]"
            :key="entry?.key ?? block.entryKey"
          >
            <div
              v-if="entry"
              class="panel-block__input"
              :data-multiline="block.isMultiline ? 'true' : 'false'"
            >
              <InputCell :entry :variant />
            </div>
          </template>
        </div>
      </div>
    </li>
  </ul>
</template>

<!--
  Exception (docs/guidance/vue-components.md §Styling): the rules
  below reach into NodeWidgets' internal grid + textarea via :deep()
  to adapt them for the panel surface. NodeWidgets is first-party but
  this component doesn't render its DOM directly — adapting it from
  the outside is the only option without touching unrelated files.
  The `!important` flags override NodeWidgets' own utility-class
  rules; they can't be won via selector specificity alone from this
  scope. Keep this block small and documented; prefer landing a
  props-based hook on NodeWidgets if more overrides accumulate.
-->
<style scoped>
/* Center number values inside ScrubableNumberInput to match the
   BatchCountCell treatment. */
.panel-block__input :deep(input:not(textarea)) {
  text-align: center;
}

/* NodeWidgets is a 3-column grid (slot-dot | label | widget) with
   pr-3. In the panel the slot-dot is empty and the label is hidden
   via HideLayoutFieldKey — collapse to a single column so widgets
   align flush with the block label above. */
.panel-block__input :deep([data-testid='node-widgets']) {
  grid-template-columns: 1fr !important;
  padding: 0 !important;
  border-radius: 0 !important;
}
.panel-block__input :deep([data-testid='node-widget']) {
  grid-template-columns: 1fr !important;
}
.panel-block__input :deep([data-testid='node-widget'] > div:first-child) {
  display: none !important;
}

/* Multiline textareas grow with content via field-sizing:content
   (Chrome 123+, Safari 17+), capped at 50vh so a long prompt can't
   push the Run button off-screen. Side-by-side textareas with
   different content lengths don't align to a shared height today;
   tracked as a known issue for a follow-up pass. */
.panel-block__input[data-multiline='true'] :deep(textarea) {
  field-sizing: content;
  height: auto !important;
  min-height: 2.5em !important;
  max-height: 50vh !important;
  resize: none !important;
}
</style>
