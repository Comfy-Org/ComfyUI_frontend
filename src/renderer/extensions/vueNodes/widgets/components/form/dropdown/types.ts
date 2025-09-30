export type OptionId = string | number | symbol
export type SelectedKey = OptionId

export interface DropdownItem {
  id: SelectedKey
  mediaSrc: string // URL for image, video, or other media
  name: string
  metadata: string
}
export interface SortOption {
  id: OptionId
  name: string
  sorter: (ctx: { items: readonly DropdownItem[] }) => DropdownItem[]
}

export interface FilterOption {
  id: OptionId
  name: string
}

export type LayoutMode = 'list' | 'grid' | 'list-small'
