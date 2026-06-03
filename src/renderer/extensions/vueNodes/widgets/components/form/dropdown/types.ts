import type { ComputedRef, InjectionKey } from 'vue'

import type { AssetKind } from '@/types/widgetTypes'

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
  /** Preview image/video URL */
  preview_url?: string
  /** Whether the item is immutable (public model) - used for ownership filtering */
  is_immutable?: boolean
  /** Base models this item is compatible with - used for base model filtering */
  base_models?: string[]
  /** Author / publisher, shown after the base model on model cards */
  author?: string
  /** Category key used to render a gradient placeholder when no preview_url exists */
  placeholder_category?: string
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
  items: FormDropdownItem[]
  /** Items used for display in the input field. Falls back to items if not provided. */
  displayItems?: FormDropdownItem[]
  selected: Set<string>
  maxSelectable: number
  uploadable: boolean
  disabled: boolean
  accept?: string
}

export interface FormDropdownMenuItemProps {
  index: number
  selected: boolean
  candidate?: boolean
  previewUrl: string
  name: string
  label?: string
  /** Publisher/organisation, shown after the base model on model cards. */
  author?: string
  /** Base models this item is compatible with, shown on model cards. */
  baseModels?: string[]
  /** When set and no previewUrl is present, render the matching gradient. */
  placeholderCategory?: string
  layout?: LayoutMode
}

export const AssetKindKey: InjectionKey<ComputedRef<AssetKind | undefined>> =
  Symbol('assetKind')
