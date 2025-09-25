export interface DropdownItem {
  id: string | number | symbol
  imageSrc: string
  name: string
  metadata: string
}

export type SelectedKey = DropdownItem['id']

export type SortOptionLabel = 'default' | 'a-z'
export interface SortOption {
  name: string
  value: SortOptionLabel
}

export type LayoutMode = 'list' | 'grid' | 'list-small'
