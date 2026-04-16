/**
 * Panel + block config types for Solution 04 (semi-customizable floating
 * panels). Phase 4-A keeps this in-memory only — persistence lands in 4-B.
 */

export type PanelPreset =
  | 'right-dock'
  | 'left-dock'
  | 'float-tr'
  | 'float-br'
  | 'float-tl'
  | 'float-bl'

export type BlockRow = BlockConfig[]

export interface BlockPos {
  row: number
  col: number
}

export type DropTarget =
  | { kind: 'columnBefore'; rowIndex: number; colIndex: number }
  | { kind: 'columnAfter'; rowIndex: number; colIndex: number }
  | { kind: 'newRowBefore'; rowIndex: number }
  | { kind: 'newRowAfter'; rowIndex: number }

export type BlockConfig = InputBlock | RunBlock

interface InputBlockBase {
  id: string
  kind: 'input'
  /** `${nodeId}:${widgetName}` — matches InputCellEntry.key */
  entryKey: string
  /** Sizing hint so the panel gives textareas room to breathe. */
  isMultiline?: boolean
}
export type InputBlock = InputBlockBase

interface RunBlockBase {
  id: string
  kind: 'run'
  /** Whether to show the batch-count row above the run button. */
  withBatchCount?: boolean
}
export type RunBlock = RunBlockBase
