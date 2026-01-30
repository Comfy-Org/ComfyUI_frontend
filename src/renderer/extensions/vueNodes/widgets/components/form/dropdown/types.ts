import type { ComputedRef, InjectionKey } from 'vue'

import type { OptionId } from '@/platform/assets/types/filterTypes'
import type { AssetKind } from '@/types/widgetTypes'

/**
 * Minimal interface for items in FormDropdown.
 * Both AssetItem (from cloud API) and local file items satisfy this contract.
 */
export interface FormDropdownItem {
  id: OptionId
  /** Display name shown in the dropdown */
  name: string
  /** Original/alternate label (e.g., original filename) */
  label?: string
  /** Preview image/video URL */
  preview_url?: string
  /** Whether the item is immutable (public model) - used for ownership filtering */
  is_immutable?: boolean
}

export interface SortOption<TId extends OptionId = OptionId> {
  id: TId
  name: string
  sorter: (ctx: { items: readonly FormDropdownItem[] }) => FormDropdownItem[]
}

export type LayoutMode = 'list' | 'grid' | 'list-small'

export const AssetKindKey: InjectionKey<ComputedRef<AssetKind | undefined>> =
  Symbol('assetKind')
