<script setup lang="ts">
/**
 * PanelBlockList — 2D grid of blocks inside a FloatingPanel.
 *
 * Phase 4-E + 4-F: rows stack vertically; within a row, blocks sit
 * side-by-side. Grip handle on each block's left edge drives pointer
 * reorder via useBlockDrag. Drop indicators: horizontal line between
 * rows, vertical line between columns.
 */
import { useTemplateRef } from 'vue'

import InputCell from '../cells/InputCell.vue'
import type { InputCellEntry, InputCellVariant } from '../cells/InputCell.vue'
import type { BlockPos, BlockRow, DropTarget } from './panelTypes'
import { useBlockDrag } from './useBlockDrag'

const { variant = 'app-mode' } = defineProps<{
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

function isDragging(row: number, col: number) {
  return draggingPos.value?.row === row && draggingPos.value.col === col
}

// --- Drop indicator predicates ------------------------------------------
// Rendering the indicator inline (as a sibling in the flex flow) keeps
// the layout math simple — no absolute positioning gymnastics.
//
// Plain functions, not computed(): the template re-reads these every
// render anyway, and returning a fresh ComputedRefImpl per call would
// allocate N × M wrappers per pointermove during a drag.
function showRowIndicator(rowIndex: number): boolean {
  const target = dropTarget.value
  if (!target) return false
  if (target.kind === 'newRowBefore') return target.rowIndex === rowIndex
  if (target.kind === 'newRowAfter') return target.rowIndex === rowIndex - 1
  return false
}

function showColIndicator(rowIndex: number, colIndex: number): boolean {
  const target = dropTarget.value
  if (!target) return false
  if (target.rowIndex !== rowIndex) return false
  if (target.kind === 'columnBefore') return target.colIndex === colIndex
  if (target.kind === 'columnAfter') return target.colIndex === colIndex - 1
  return false
}
</script>

<template>
  <ul ref="listEl" class="panel-block-list" role="list">
    <template
      v-for="(row, rowIdx) in rows"
      :key="`row-${rowIdx}-${row[0]?.id}`"
    >
      <!-- Horizontal drop indicator (between-row). -->
      <li
        v-show="showRowIndicator(rowIdx)"
        class="drop-indicator drop-indicator--row"
        aria-hidden="true"
      />
      <li class="panel-block-row" :data-block-row="rowIdx">
        <template v-for="(block, colIdx) in row" :key="block.id">
          <!-- Vertical drop indicator (between-column). -->
          <span
            v-show="showColIndicator(rowIdx, colIdx)"
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
            <!-- Grip is a pointer-only affordance — hidden from the tab
                 order and screen readers until keyboard reorder
                 (Enter/Space to grab, arrow keys to move, Enter to drop)
                 lands as a follow-up. Was a focusable <button>, but tabbing
                 to it did nothing, which is the focusable-but-inert
                 antipattern. -->
            <span
              class="panel-block__grip"
              aria-hidden="true"
              @pointerdown="startDrag({ row: rowIdx, col: colIdx }, $event)"
            >
              <span class="panel-block__grip-dots" aria-hidden="true" />
            </span>
            <div class="panel-block__content">
              <div
                v-if="inputEntryMap.get(block.entryKey)"
                class="panel-block__input"
                :data-multiline="block.isMultiline ? 'true' : 'false'"
              >
                <InputCell
                  :entry="inputEntryMap.get(block.entryKey)!"
                  :variant
                />
              </div>
            </div>
          </div>
        </template>
        <!-- Trailing column drop indicator (after last col in this row). -->
        <span
          v-show="showColIndicator(rowIdx, row.length)"
          class="drop-indicator drop-indicator--col"
          aria-hidden="true"
        />
      </li>
    </template>
    <!-- Trailing row drop indicator (after the last row). -->
    <li
      v-show="showRowIndicator(rows.length)"
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
  border-radius: var(--radius-layout-cell);
  background-color: transparent;
  transition: opacity var(--duration-layout) var(--ease-layout);
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
  transition: opacity var(--duration-layout) var(--ease-layout);
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
    var(--color-layout-mute) 1px,
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

/* Both drop-indicator types (row + column) share the same accent so the
   "landing zone" reads consistently. Color lives as a layout token
   (see packages/design-system/src/css/layout.css) rather than inlined
   hex, per the no-raw-hex anti-pattern in DESIGN.md. */
.drop-indicator {
  list-style: none;
  background-color: var(--color-layout-drop-indicator);
  border-radius: 1px;
  box-shadow: 0 0 0 2px
    color-mix(in srgb, var(--color-layout-drop-indicator) 25%, transparent);
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
