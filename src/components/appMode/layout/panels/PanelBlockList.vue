<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, useTemplateRef } from 'vue'

import InputCell from '../cells/InputCell.vue'
import type { InputCellEntry, InputCellVariant } from '../cells/InputCell.vue'
import type { BlockPos, BlockRow, DropTarget } from './panelTypes'
import { applyMove } from './useAppPanelLayout'
import { useBlockDrag } from './useBlockDrag'
import { useFlipReorder } from './useFlipReorder'

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

// Preview the post-drop layout while dragging; data-block-row/col
// keep their original coords so hit-testing math stays consistent.
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
  // Skip in app-mode so preventDefault doesn't suppress widget focus.
  if (variant !== 'builder') return
  const pos = originalById.value.get(blockId)
  if (pos) startDrag(pos, event)
}

// Skip the dragging block; its lift treatment overrides the slide.
useFlipReorder(listEl, { skipKey: () => draggingBlockId.value })
</script>

<template>
  <ul ref="listEl" class="m-0 flex list-none flex-col gap-2.5 p-0" role="list">
    <li
      v-for="(row, rowIdx) in displayRows"
      :key="rowIdx"
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
              'hover:outline-offset-1.5 hover:outline-2 hover:outline-warning-background hover:outline-dashed'
            ],
            block.id === draggingBlockId && [
              'z-20 scale-[1.02] shadow-2xl',
              'outline-offset-1.5 outline-2 outline-warning-background outline-dashed'
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
          <!-- v-for + v-if narrows the Map lookup without `!`. -->
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
        <!-- Tint paints in gaps between opaque widgets. -->
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
.panel-block__input :deep(input) {
  text-align: center;
}

/* Collapse NodeWidgets' 3-col grid; dot + label are hidden upstream. */
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

/* Auto-grow textareas; panel max-h scrolls instead. */
.panel-block__input[data-multiline='true'] :deep(textarea) {
  field-sizing: content;
  height: auto !important;
  min-height: 2.5em !important;
  resize: none !important;
}
</style>
