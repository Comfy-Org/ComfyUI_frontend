<script setup lang="ts">
/**
 * PanelBlockList — 2D grid of blocks inside a FloatingPanel.
 *
 * Phase 4-E + 4-F: rows stack vertically; within a row, blocks sit
 * side-by-side. Grip handle on each block's left edge drives pointer
 * reorder via useBlockDrag. Drop indicators: horizontal line between
 * rows, vertical line between columns.
 */
import { computed, useTemplateRef } from 'vue'

import InputCell from '../cells/InputCell.vue'
import type { InputCellEntry } from '../cells/InputCell.vue'
import RunCell from '../cells/RunCell.vue'
import BatchCountCell from '../cells/BatchCountCell.vue'
import type { BlockPos, BlockRow, DropTarget } from './panelTypes'
import { useBlockDrag } from './useBlockDrag'

const props = defineProps<{
  rows: BlockRow[]
  inputEntryMap: Map<string, InputCellEntry>
  onReorder?: (from: BlockPos, target: DropTarget) => void
}>()

const listEl = useTemplateRef<HTMLElement>('listEl')

const { draggingPos, dropTarget, startDrag } = useBlockDrag({
  listEl,
  onCommit: (from, target) => props.onReorder?.(from, target)
})

function isDragging(row: number, col: number) {
  return draggingPos.value?.row === row && draggingPos.value.col === col
}

// --- Drop indicator predicates ------------------------------------------
// Rendering the indicator inline (as a sibling in the flex flow) keeps
// the layout math simple — no absolute positioning gymnastics.

const showRowIndicator = (rowIndex: number) =>
  computed(() => {
    const t = dropTarget.value
    if (!t) return false
    if (t.kind === 'newRowBefore') return t.rowIndex === rowIndex
    if (t.kind === 'newRowAfter') return t.rowIndex === rowIndex - 1
    return false
  })

const showColIndicator = (rowIndex: number, colIndex: number) =>
  computed(() => {
    const t = dropTarget.value
    if (!t) return false
    if (t.rowIndex !== rowIndex) return false
    if (t.kind === 'columnBefore') return t.colIndex === colIndex
    if (t.kind === 'columnAfter') return t.colIndex === colIndex - 1
    return false
  })
</script>

<template>
  <ul ref="listEl" class="panel-block-list" role="list">
    <template
      v-for="(row, rowIdx) in rows"
      :key="`row-${rowIdx}-${row[0]?.id}`"
    >
      <!-- Horizontal drop indicator (between-row). -->
      <li
        v-show="showRowIndicator(rowIdx).value"
        class="drop-indicator drop-indicator--row"
        aria-hidden="true"
      />
      <li class="panel-block-row" :data-block-row="rowIdx">
        <template v-for="(block, colIdx) in row" :key="block.id">
          <!-- Vertical drop indicator (between-column). -->
          <span
            v-show="showColIndicator(rowIdx, colIdx).value"
            class="drop-indicator drop-indicator--col"
            aria-hidden="true"
          />
          <div
            class="panel-block"
            :class="{ 'panel-block--dragging': isDragging(rowIdx, colIdx) }"
            :data-block-row="rowIdx"
            :data-block-col="colIdx"
            :data-block-kind="block.kind"
          >
            <button
              type="button"
              class="panel-block__grip"
              :aria-label="`Drag to reorder ${block.kind} block`"
              @pointerdown="startDrag({ row: rowIdx, col: colIdx }, $event)"
            >
              <span class="panel-block__grip-dots" aria-hidden="true" />
            </button>
            <div class="panel-block__content">
              <template v-if="block.kind === 'input'">
                <div
                  v-if="inputEntryMap.get(block.entryKey)"
                  class="panel-block__input"
                  :data-multiline="block.isMultiline ? 'true' : 'false'"
                >
                  <InputCell :entry="inputEntryMap.get(block.entryKey)!" />
                </div>
              </template>
              <template v-else-if="block.kind === 'run'">
                <div class="panel-block__run">
                  <div
                    v-if="block.withBatchCount"
                    class="panel-block__run-batch"
                  >
                    <BatchCountCell />
                  </div>
                  <div class="panel-block__run-button">
                    <RunCell />
                  </div>
                </div>
              </template>
            </div>
          </div>
        </template>
        <!-- Trailing column drop indicator (after last col in this row). -->
        <span
          v-show="showColIndicator(rowIdx, row.length).value"
          class="drop-indicator drop-indicator--col"
          aria-hidden="true"
        />
      </li>
    </template>
    <!-- Trailing row drop indicator (after the last row). -->
    <li
      v-show="showRowIndicator(rows.length).value"
      class="drop-indicator drop-indicator--row"
      aria-hidden="true"
    />
  </ul>
</template>

<style scoped>
.panel-block-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.panel-block-row {
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: stretch;
  min-width: 0;
}

.panel-block {
  position: relative;
  display: flex;
  align-items: stretch;
  flex: 1 1 0;
  min-width: 0;
  border-radius: var(--bento-cell-radius);
  background-color: transparent;
  transition: opacity var(--bento-transition-duration)
    var(--bento-transition-easing);
}

.panel-block--dragging {
  opacity: 0.35;
}

.panel-block__grip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  cursor: grab;
  opacity: 0;
  transition: opacity var(--bento-transition-duration)
    var(--bento-transition-easing);
  touch-action: none;
}
.panel-block:hover .panel-block__grip,
.panel-block--dragging .panel-block__grip {
  opacity: 0.7;
}
.panel-block__grip:active {
  cursor: grabbing;
}

.panel-block__grip-dots {
  width: 4px;
  height: 16px;
  background-image: radial-gradient(
    circle,
    var(--bento-color-text-muted) 1px,
    transparent 1.2px
  );
  background-size: 4px 4px;
  background-repeat: repeat-y;
}

.panel-block__content {
  flex: 1;
  min-width: 0;
}

.panel-block__input {
  height: 72px;
}
.panel-block__input[data-multiline='true'] {
  height: 120px;
}

.panel-block__run {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0 4px;
}

.panel-block__run-batch {
  height: 44px;
  border-radius: var(--bento-cell-radius);
  background-color: var(--bento-color-canvas);
}

.panel-block__run-button {
  height: 56px;
}

/* International Klein Blue (#002FA7) for both drop-indicator types so
   the "landing zone" reads consistently across row + column drops. */
.drop-indicator {
  list-style: none;
  background-color: #002fa7;
  border-radius: 1px;
  box-shadow: 0 0 0 2px rgb(0 47 167 / 0.25);
  pointer-events: none;
}

.drop-indicator--row {
  height: 3px;
  margin: 0;
  width: 100%;
}

.drop-indicator--col {
  display: inline-block;
  width: 3px;
  align-self: stretch;
  flex-shrink: 0;
}
</style>
