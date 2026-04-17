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
import { useI18n } from 'vue-i18n'

import InputCell from '../cells/InputCell.vue'
import type { InputCellEntry } from '../cells/InputCell.vue'
import RunCell from '../cells/RunCell.vue'
import BatchCountCell from '../cells/BatchCountCell.vue'
import type { BlockPos, BlockRow, DropTarget } from './panelTypes'
import { useBlockDrag } from './useBlockDrag'

const { t } = useI18n()

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
              :aria-label="
                t('linearMode.blockDragReorderAria', { kind: block.kind })
              "
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
  /* 10px matches the InputCell header→body gap so the rhythm is
     uniform: the space between one widget's input and the next
     widget's label equals the space between a label and its input. */
  gap: 10px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.panel-block-row {
  display: flex;
  flex-direction: row;
  /* 16px matches the grip width — the grip fills the gap exactly,
     with the 4px dots centered so there's 6px clear on each side. */
  gap: 16px;
  align-items: stretch;
  min-width: 0;
}

.panel-block {
  position: relative;
  display: block;
  flex: 1 1 0;
  min-width: 0;
  border-radius: var(--layout-cell-radius);
  background-color: transparent;
  transition: opacity var(--layout-transition-duration)
    var(--layout-transition-easing);
}

.panel-block--dragging {
  opacity: 0.35;
}

/* Grip is absolutely positioned into the panel body's left padding
   (panel body padding is 16px; grip width is 16px → grip's right edge
   touches the block's left edge). Out of flow → block content gets
   full width and the panel reads with symmetric 16px outer margins. */
.panel-block__grip {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -16px;
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
  transition: opacity var(--layout-transition-duration)
    var(--layout-transition-easing);
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
  height: 100%;
  background-image: radial-gradient(
    circle,
    var(--layout-color-text-muted) 1px,
    transparent 1.2px
  );
  background-size: 4px 4px;
  background-repeat: repeat-y;
}

.panel-block__content {
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.panel-block__input {
  /* Content-driven height for all input blocks so vertical spacing
     between blocks stays consistent (the 8px gap from panel-block-list
     is the only space between them). */
}

/* Center number values inside ScrubableNumberInput (the −/+ widgets)
   so they match the "Number of runs" BatchCountCell treatment. */
.panel-block__input :deep(input:not(textarea)) {
  text-align: center;
}

/* NodeWidgets is a 3-column grid (slot-dot | label | widget) with
   pr-3. In the panel, the slot-dot is empty and the label is hidden
   (HideLayoutFieldKey). Collapse to single-column so widgets align
   flush with the block label above them. */
.panel-block__input :deep([data-testid='node-widgets']) {
  grid-template-columns: 1fr !important;
  padding: 0 !important;
  border-radius: 0 !important;
}
.panel-block__input :deep([data-testid='node-widget']) {
  grid-template-columns: 1fr !important;
}
/* Hide the empty slot-dot column. */
.panel-block__input :deep([data-testid='node-widget'] > div:first-child) {
  display: none !important;
}

/* BatchCountCell: remove horizontal padding so it aligns with the Run
   button below it. */
.panel-block__run-batch :deep(.batch-count-cell) {
  padding: 0;
}

/* All input blocks use content-driven height. Unset InputCell's
   overflow: hidden + flex: 1 on the body so cells don't clip or
   stretch their content. */
.panel-block__input :deep(.input-cell) {
  height: auto;
}
.panel-block__input :deep(.input-cell__body) {
  flex: 0 0 auto;
  overflow: visible;
  min-height: 0;
}

/* Multiline textareas use field-sizing:content to grow with their
   value until a cap; scrollbar kicks in only when truly needed. */
.panel-block__input[data-multiline='true'] :deep(textarea) {
  /* field-sizing: content auto-sizes to rows of content (Chrome 123+,
     Safari 17+). max-height caps growth so a huge prompt can't push
     the Run button off-screen. */
  field-sizing: content;
  height: auto !important;
  min-height: 2.5em !important;
  max-height: 50vh !important;
  resize: none !important;
}

.panel-block__run {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
}

.panel-block__run-batch {
  height: 48px;
}

.panel-block__run-button {
  height: 48px;
}

/* Comfy brand blue (#1E40FF) for both drop-indicator types so
   the "landing zone" reads consistently across row + column drops. */
.drop-indicator {
  list-style: none;
  background-color: #1e40ff;
  border-radius: 1px;
  box-shadow: 0 0 0 2px rgb(30 64 255 / 0.25);
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
