/**
 * Asset filtering and sorting types
 * Shared across AssetBrowser, AssetFilterBar, and widget dropdowns
 */

/**
 * Generic filter/select option used across components
 * Compatible with both SelectOption (name/value) and FilterOption (id/name) patterns
 */
export interface FilterOption {
  id: string
  name: string
}

/**
 * Ownership filter options for assets
 * - 'all': Show all assets
 * - 'my-models': Show only user-owned assets (is_immutable === false)
 * - 'public-models': Show only public assets (is_immutable === true)
 */
export type OwnershipOption = 'all' | 'my-models' | 'public-models'

/**
 * Ownership filter option for dropdowns/selects
 */
export interface OwnershipFilterOption {
  id: OwnershipOption
  name: string
}

/**
 * Sort options for asset lists
 * - 'default': Preserve original order (no sorting)
 * - 'recent': Sort by created_at descending
 * - 'name-asc': Sort by display name A-Z
 * - 'name-desc': Sort by display name Z-A
 */
export type AssetSortOption = 'default' | 'recent' | 'name-asc' | 'name-desc'

/**
 * Filter state for asset browser and filter bar
 */
export interface AssetFilterState {
  fileFormats: string[]
  baseModels: string[]
  sortBy: AssetSortOption
  ownership: OwnershipOption
}
