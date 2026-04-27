<script setup lang="ts">
/**
 * PanelBlockList — 2D grid of blocks inside a FloatingPanel.
 *
 * Rows stack vertically; within a row, blocks sit side-by-side.
 *
 * Variant-gated drag:
 * - `builder` — the whole block is the drag target (no grip). Widget
 *   bodies are already inert in this variant (see InputCell), so a
 *   stray click on a text field can't eat the drag. This mode is
 *   where users restructure the layout.
 * - `app-mode` — drag is disabled entirely. Widgets are fully
 *   interactive (users type prompts, scrub numbers, etc.) without
 *   any risk of accidentally reordering; re-enter builder to edit
 *   the layout.
 *
 * Motion: FLIP animation (capture rects before update, apply inverse
 * transform after, transition back to zero) so blocks slide into
 * their new positions instead of snapping. The dragging block is
 * excluded from FLIP — it's anchored at its target by the reshuffle
 * preview and lifted (shadow + scale); animating it would compete
 * with that affordance.
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

// id of the block in flight — used to flag it in the displayed rows,
// apply the lift styling, and skip it during FLIP animation.
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

// Builder-only drag entry point. `startDrag` preventDefaults the
// pointerdown, so short-circuiting here in app-mode means native
// text-selection / focus behavior inside widgets is untouched.
function beginDrag(blockId: string, event: PointerEvent) {
  if (variant !== 'builder') return
  const pos = originalById.value.get(blockId)
  if (pos) startDrag(pos, event)
}

// --- FLIP reorder animation --------------------------------------
// `onBeforeUpdate` fires on any reactive update (including drag-
// preview reshuffles and committed reorders), so we sample rects
// each time and only animate blocks whose positions actually
// changed. The dragging block is excluded because it's visually
// held at its target by the lift treatment.
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
    // Sub-pixel deltas (layout rounding) would animate a barely-
    // visible jiggle every keystroke; skip them.
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
    // Invert: jump back to the old position with no transition…
    el.style.transform = `translate(${dx}px, ${dy}px)`
    el.style.transition = 'none'
    // …then on the next frame, enable the transition and clear the
    // transform so the browser interpolates back to its natural
    // (new) position. Double-RAF avoids the browser batching the
    // two style writes and skipping the animation.
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
  <!--
    During drag, `displayRows` shows the layout exactly as it would
    look after the drop (via `applyMove`). The block in flight lands
    at its proposed new position, lifted with shadow + scale so the
    user sees what they're holding while the other blocks slide into
    their new arrangement via FLIP. 10px list gap matches InputCell's
    header→body gap so the vertical rhythm stays uniform.
  -->
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
              'hover:outline-2 hover:outline-offset-[6px] hover:outline-(--color-app-mode-active-temp) hover:outline-dashed'
            ],
            block.id === draggingBlockId && [
              'z-20 scale-[1.02] shadow-2xl',
              'outline-2 outline-offset-[6px] outline-(--color-app-mode-active-temp) outline-dashed'
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
        <!--
          Drag-tint overlay: child widgets + label rows paint their
          own opaque backgrounds, so a bg class on the block itself
          only bleeds through in the gaps. Absolute overlay sized to
          the outline's rect (matching -inset / offset) sits above
          the content with `pointer-events-none` so clicks still
          bubble into the drag machinery. Rendered only while the
          block is in flight.
        -->
        <div
          v-if="block.id === draggingBlockId"
          class="pointer-events-none absolute -inset-1.5 z-10 rounded-layout-cell bg-(--color-app-mode-active-temp-wash)"
          aria-hidden="true"
        />
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
   (Chrome 123+, Safari 17+). No max-height cap here — the panel's
   own `max-h-*` (panelPresetClasses) is the single ceiling. The
   textarea grows freely with content; once total widget height
   exceeds the panel cap, the panel body's `overflow-y-auto` is
   what scrolls, not the textarea internally. Side-by-side
   textareas with different content lengths still don't align to a
   shared height — tracked as a follow-up. */
.panel-block__input[data-multiline='true'] :deep(textarea) {
  field-sizing: content;
  height: auto !important;
  min-height: 2.5em !important;
  resize: none !important;
}
</style>
