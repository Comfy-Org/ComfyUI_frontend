export interface DropdownItem {
  id: string | number
  imageSrc: string
  name: string
  metadata: string
}

export type SortOptionLabel = 'default' | 'a-z'
export interface SortOption {
  name: string
  value: SortOptionLabel
}

export type LayoutMode = 'list' | 'grid' | 'list-small'
