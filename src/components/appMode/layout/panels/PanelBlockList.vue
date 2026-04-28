<script setup lang="ts">
/**
 * 2D grid of blocks inside a FloatingPanel — rows stack vertically,
 * blocks within a row sit side-by-side. Drag-to-reorder is gated to
 * the `builder` variant (whole block is the drag target; widget
 * bodies are inert there) and disabled in `app-mode` so widgets stay
 * fully interactive without reorder risk. Reorders animate via FLIP;
 * the dragging block is excluded so its lift treatment doesn't
 * compete with the slide.
 */
import { cn } from '@comfyorg/tailwind-utils'
import { computed, onBeforeUpdate, onUpdated, useTemplateRef } from 'vue'

import InputCell from '../cells/InputCell.vue'
import type { InputCellEntry, InputCellVariant } from '../cells/InputCell.vue'
import type { BlockPos, BlockRow, DropTarget } from './panelTypes'
import { applyMove } from './useAppPanelLayout'
import { useBlockDrag } from './useBlockDrag'

const { rows, variant = 'app-mode' } = defineProps<{
  rows: BlockRow[]
  inputEntryMap: Map<string, InputCellEntry>
  /** Forwarded to InputCell — `builder` adds the ⋯ Rename/Remove menu
   *  and makes the widget body inert, and is also the only variant
   *  where drag-to-reorder is active. */
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

const draggingBlockId = computed<string | null>(() => {
  const pos = draggingPos.value
  if (!pos) return null
  return rows[pos.row]?.[pos.col]?.id ?? null
})

// During drag, render the layout as it would look after the drop (via
// `applyMove` — the same math the commit uses). `data-block-row/col`
// attributes below stay in ORIGINAL coords so useBlockDrag's hit
// math returns drop targets in the space applyMove expects.
const displayRows = computed<BlockRow[]>(() => {
  const pos = draggingPos.value
  const target = dropTarget.value
  if (!pos || !target) return rows
  return applyMove(rows, pos, target)
})

const originalById = computed(() => {
  const map = new Map<string, BlockPos>()
  rows.forEach((row, ri) =>
    row.forEach((b, ci) => map.set(b.id, { row: ri, col: ci }))
  )
  return map
})

function beginDrag(blockId: string, event: PointerEvent) {
  // Short-circuit in app-mode so startDrag's preventDefault doesn't
  // suppress native widget text-selection / focus.
  if (variant !== 'builder') return
  const pos = originalById.value.get(blockId)
  if (pos) startDrag(pos, event)
}

// --- FLIP reorder animation --------------------------------------
// `onBeforeUpdate` fires on every reactive update (drag-preview
// reshuffles + committed reorders), so we re-sample rects each time
// and only animate blocks whose positions actually changed.
const FLIP_DURATION_MS = 200
const prevRects = new Map<string, DOMRect>()

onBeforeUpdate(() => {
  prevRects.clear()
  const els = listEl.value?.querySelectorAll<HTMLElement>('[data-flip-key]')
  if (!els) return
  for (const el of els) {
    const key = el.dataset.flipKey
    if (key) prevRects.set(key, el.getBoundingClientRect())
  }
})

onUpdated(() => {
  const els = listEl.value?.querySelectorAll<HTMLElement>('[data-flip-key]')
  if (!els) return
  const draggingId = draggingBlockId.value
  for (const el of els) {
    const key = el.dataset.flipKey
    if (!key || key === draggingId) continue
    const prev = prevRects.get(key)
    if (!prev) continue
    const next = el.getBoundingClientRect()
    const dx = prev.left - next.left
    const dy = prev.top - next.top
    // Skip sub-pixel deltas — they'd animate a jiggle every keystroke.
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
    // FLIP: jump to the old position with no transition, then on the
    // next frame re-enable the transition and clear the transform so
    // the browser interpolates back. Double-RAF prevents the browser
    // from batching both style writes and skipping the animation.
    el.style.transform = `translate(${dx}px, ${dy}px)`
    el.style.transition = 'none'
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = `transform ${FLIP_DURATION_MS}ms ease`
        el.style.transform = ''
      })
    })
  }
})
</script>

<template>
  <!-- 10px list gap matches InputCell's header→body gap so the
       vertical rhythm stays uniform. -->
  <ul
    ref="listEl"
    class="m-0 flex list-none flex-col gap-[10px] p-0"
    role="list"
  >
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
            'duration-layout transition-[box-shadow,transform] ease-layout',
            variant === 'builder' && [
              'cursor-grab touch-none active:cursor-grabbing',
              'hover:outline-2 hover:outline-offset-[6px] hover:outline-warning-background hover:outline-dashed'
            ],
            block.id === draggingBlockId && [
              'z-20 scale-[1.02] shadow-2xl',
              'outline-2 outline-offset-[6px] outline-warning-background outline-dashed'
            ]
          )
        "
        :data-block-row="originalById.get(block.id)?.row"
        :data-block-col="originalById.get(block.id)?.col"
        :data-block-kind="block.kind"
        :data-dragging="block.id === draggingBlockId ? 'true' : undefined"
        :data-flip-key="block.id"
        @pointerdown="beginDrag(block.id, $event)"
      >
        <div class="w-full min-w-0 overflow-hidden">
          <!-- 1-item v-for binds the Map lookup into `entry`, then v-if
               narrows it so InputCell's :entry is typed without `!`. -->
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
        <!-- Drag-tint overlay: child widgets paint opaque backgrounds,
             so a bg class on the block bleeds through only in gaps.
             pointer-events-none lets the drag machinery still see clicks. -->
        <div
          v-if="block.id === draggingBlockId"
          class="pointer-events-none absolute -inset-1.5 z-10 rounded-layout-cell bg-warning-background/10"
          aria-hidden="true"
        />
      </div>
    </li>
  </ul>
</template>

<!--
  Documented exception (docs/guidance/vue-components.md §Styling):
  these rules reach into NodeWidgets' internal grid + textarea via
  :deep() because this component doesn't render NodeWidgets' DOM
  directly. The `!important` flags can't be won by selector
  specificity from this scope. Prefer a props-based hook on
  NodeWidgets if more overrides accumulate.
-->
<style scoped>
/* Center scrubable-number values to match BatchCountCell. */
.panel-block__input :deep(input:not(textarea)) {
  text-align: center;
}

/* NodeWidgets is a 3-col grid (slot-dot | label | widget). The dot
   is empty and the label is hidden via HideLayoutFieldKey here —
   collapse to a single column so widgets align flush. */
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

/* Multiline textareas auto-grow via field-sizing:content; the panel's
   own max-h-* is the single height ceiling so the panel body scrolls
   instead of the textarea internally. Side-by-side textareas with
   different content lengths don't align to a shared height yet —
   tracked as a follow-up. */
.panel-block__input[data-multiline='true'] :deep(textarea) {
  field-sizing: content;
  height: auto !important;
  min-height: 2.5em !important;
  resize: none !important;
}
</style>
