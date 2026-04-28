<script setup lang="ts">
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
  /** `builder` enables drag-to-reorder + makes widget bodies inert. */
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

// During drag, preview the post-drop layout via the same applyMove
// the commit uses. `data-block-row/col` stay in ORIGINAL coords so
// hit-testing returns drop targets in the space applyMove expects.
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
  // app-mode: skip so startDrag's preventDefault doesn't suppress
  // widget text-selection / focus.
  if (variant !== 'builder') return
  const pos = originalById.value.get(blockId)
  if (pos) startDrag(pos, event)
}

// FLIP reorder animation. Re-samples rects on each reactive update
// (drag-preview reshuffles + committed reorders).
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
    // Skip sub-pixel deltas — would animate a jiggle every keystroke.
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
    // Double-RAF: write the inverse transform, then re-enable transition
    // on the next frame so the browser doesn't batch and skip.
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
          <!-- 1-item v-for + v-if narrows the Map lookup so :entry is
               typed without `!`. -->
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
        <!-- Tint paints in the gaps between widgets (which paint
             opaque); pointer-events-none keeps drag tracking. -->
        <div
          v-if="block.id === draggingBlockId"
          class="pointer-events-none absolute -inset-1.5 z-10 rounded-layout-cell bg-warning-background/10"
          aria-hidden="true"
        />
      </div>
    </li>
  </ul>
</template>

<!-- :deep() into NodeWidgets internals; documented exception in
     docs/guidance/vue-components.md §Styling. -->
<style scoped>
.panel-block__input :deep(input:not(textarea)) {
  text-align: center;
}

/* Collapse NodeWidgets' 3-col grid (slot-dot | label | widget) to
   a single column — dot is empty, label is hidden via HideLayoutFieldKey. */
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

/* Auto-grow via field-sizing:content; panel's max-h is the single
   height ceiling so the panel body scrolls, not the textarea. */
.panel-block__input[data-multiline='true'] :deep(textarea) {
  field-sizing: content;
  height: auto !important;
  min-height: 2.5em !important;
  resize: none !important;
}
</style>
