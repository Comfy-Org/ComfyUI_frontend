/**
 * Panel + block config types for the semi-customizable floating panel.
 * In-memory only for now; persistence is a follow-up.
 */

export type PanelPreset =
  | 'right-dock'
  | 'left-dock'
  | 'float-tr'
  | 'float-br'
  | 'float-tl'
  | 'float-bl'

// Preset-shape predicates — keep consumers off `startsWith` /
// `endsWith` parses; the union stays the single source of truth.
export const isDockPreset = (p: PanelPreset): boolean =>
  p === 'right-dock' || p === 'left-dock'

export const isFloatBottom = (p: PanelPreset): boolean =>
  p === 'float-bl' || p === 'float-br'

export const panelSide = (p: PanelPreset): 'left' | 'right' =>
  p === 'left-dock' || p === 'float-tl' || p === 'float-bl' ? 'left' : 'right'

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

export type BlockConfig = InputBlock

interface InputBlockBase {
  id: string
  kind: 'input'
  /** `${nodeId}:${widgetName}` — matches InputCellEntry.key */
  entryKey: string
  /** Sizing hint so the panel gives textareas room to breathe. */
  isMultiline?: boolean
}
export type InputBlock = InputBlockBase
