import type { OptionId } from './filterTypes'

/**
 * Lightweight display projection of AssetItem for dropdown/selection UIs.
 * Used by FormDropdown and WidgetSelectDropdown.
 */
export interface AssetDropdownItem {
  id: OptionId
  /** Display name (user-defined filename or asset name) */
  name: string
  /** Original filename from asset */
  label?: string
  /** Preview image/video URL */
  previewUrl: string
}
