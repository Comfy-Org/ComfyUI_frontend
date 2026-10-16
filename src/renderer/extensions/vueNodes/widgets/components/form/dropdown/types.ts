import type { Thumbnail } from '@/platform/assets/utils/assetThumbnailUtil'

/**
 * Minimal interface for items in FormDropdown.
 * Both AssetItem (from cloud API) and local file items satisfy this contract.
 */
export interface FormDropdownItem {
  id: string
  /** Display name shown in the dropdown */
  name: string
  /** Original/alternate label (e.g., original filename) */
  label?: string
  thumbnail: Thumbnail
  /** Whether the item is immutable (public model) - used for ownership filtering */
  is_immutable?: boolean
  /** Base models this item is compatible with - used for base model filtering */
  base_models?: string[]
}

export interface SortOption<TId extends string = string> {
  id: TId
  name: string
  sorter: (ctx: { items: readonly FormDropdownItem[] }) => FormDropdownItem[]
}

export type LayoutMode = 'list' | 'grid' | 'list-small'

export interface FormDropdownInputProps {
  isOpen?: boolean
  placeholder?: string
  selectedItems: readonly FormDropdownItem[]
  maxSelectable: number
  uploadable: boolean
  disabled: boolean
  accept?: string
  isUploading?: boolean
}

export interface FormDropdownMenuItemProps {
  index: number
  selected: boolean
  candidate?: boolean
  thumbnail: Thumbnail
  name: string
  label?: string
  layout?: LayoutMode
}
