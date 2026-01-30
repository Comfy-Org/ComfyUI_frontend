import type { ComputedRef, InjectionKey } from 'vue'

import type {
  FilterOption,
  OptionId
} from '@/platform/assets/types/filterTypes'
import type { AssetKind } from '@/types/widgetTypes'

export type { FilterOption, OptionId }

export type SelectedKey = OptionId

export interface DropdownItem {
  id: SelectedKey
  mediaSrc: string // URL for image, video, or other media
  name: string
  label?: string
  metadata: string
}

export interface SortOption<TId extends OptionId = OptionId> {
  id: TId
  name: string
  sorter: (ctx: { items: readonly DropdownItem[] }) => DropdownItem[]
}

export type LayoutMode = 'list' | 'grid' | 'list-small'

export const AssetKindKey: InjectionKey<ComputedRef<AssetKind | undefined>> =
  Symbol('assetKind')
