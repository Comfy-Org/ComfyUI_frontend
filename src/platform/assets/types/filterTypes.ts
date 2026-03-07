export interface FilterOption {
  name: string
  value: string
}

export type OwnershipOption = 'all' | 'my-models' | 'public-models'

export interface OwnershipFilterOption {
  name: string
  value: OwnershipOption
}

export type AssetSortOption = 'default' | 'recent' | 'name-asc' | 'name-desc'

export interface AssetFilterState {
  fileFormats: string[]
  baseModels: string[]
  sortBy: AssetSortOption
  ownership: OwnershipOption
}
