import type { ComputedRef, InjectionKey } from 'vue'

import type { AssetDropdownItem } from '@/platform/assets/types/assetDropdownTypes'
import type { OptionId } from '@/platform/assets/types/filterTypes'
import type { AssetKind } from '@/types/widgetTypes'

export interface SortOption<TId extends OptionId = OptionId> {
  id: TId
  name: string
  sorter: (ctx: { items: readonly AssetDropdownItem[] }) => AssetDropdownItem[]
}

export type LayoutMode = 'list' | 'grid' | 'list-small'

export const AssetKindKey: InjectionKey<ComputedRef<AssetKind | undefined>> =
  Symbol('assetKind')
