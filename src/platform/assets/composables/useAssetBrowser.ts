import { computed, ref } from 'vue'

import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

type AssetBadge = {
  label: string
  type: 'type' | 'base' | 'size'
}

// Display properties for transformed assets
export interface AssetDisplayItem extends AssetItem {
  description: string
  formattedSize: string
  badges: AssetBadge[]
  stats: {
    formattedDate?: string
    downloadCount?: string
    stars?: string
  }
}

/**
 * Asset Browser composable
 * Manages search, filtering, asset transformation and selection logic
 */
export function useAssetBrowser(assets: AssetItem[] = []) {
  // State
  const searchQuery = ref('')
  const selectedCategory = ref('all')
  const sortBy = ref('name')

  // Transform API asset to display asset
  function transformAssetForDisplay(asset: AssetItem): AssetDisplayItem {
    // Extract description from metadata or create from tags
    const typeTag = asset.tags.find((tag) => tag !== 'models')
    const description =
      asset.user_metadata?.description || `${typeTag || 'Unknown'} model`

    // Format file size
    const formattedSize = formatFileSize(asset.size)

    // Create badges from tags and metadata
    const badges: AssetBadge[] = []

    // Type badge from non-root tag
    if (typeTag) {
      badges.push({ label: typeTag, type: 'type' })
    }

    // Base model badge from metadata
    if (asset.user_metadata?.base_model) {
      badges.push({
        label: asset.user_metadata.base_model,
        type: 'base'
      })
    }

    // Size badge
    badges.push({ label: formattedSize, type: 'size' })

    // Create display stats from API data
    const stats = {
      formattedDate: new Date(asset.created_at).toLocaleDateString(),
      downloadCount: undefined, // Not available in API
      stars: undefined // Not available in API
    }

    return {
      ...asset,
      description,
      formattedSize,
      badges,
      stats
    }
  }

  // Helper to format file sizes
  function formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  // Extract available categories from assets
  const availableCategories = computed(() => {
    const categorySet = new Set<string>()

    assets.forEach((asset) => {
      // Second tag is the category (after 'models' root tag)
      if (asset.tags.length > 1 && asset.tags[0] === 'models') {
        categorySet.add(asset.tags[1])
      }
    })

    return [
      { id: 'all', label: 'All Models', icon: 'icon-[lucide--folder]' },
      ...Array.from(categorySet)
        .sort()
        .map((category) => ({
          id: category,
          label: category.charAt(0).toUpperCase() + category.slice(1),
          icon: 'icon-[lucide--package]'
        }))
    ]
  })

  // Compute content title from selected category
  const contentTitle = computed(() => {
    if (selectedCategory.value === 'all') {
      return 'All Models'
    }

    const category = availableCategories.value.find(
      (cat) => cat.id === selectedCategory.value
    )
    return category?.label || 'Assets'
  })

  // Computed filtered and transformed assets
  const filteredAssets = computed(() => {
    let filtered = [...assets]

    // Filter by category (tag-based)
    if (selectedCategory.value !== 'all') {
      filtered = filtered.filter((asset) =>
        asset.tags.includes(selectedCategory.value)
      )
    }

    // Filter by search query
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      filtered = filtered.filter(
        (asset) =>
          asset.name.toLowerCase().includes(query) ||
          asset.user_metadata?.description?.toLowerCase().includes(query) ||
          asset.tags.some((tag) => tag.toLowerCase().includes(query))
      )
    }

    // Sort assets
    filtered.sort((a, b) => {
      switch (sortBy.value) {
        case 'date':
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        case 'name':
        default:
          return a.name.localeCompare(b.name)
      }
    })

    // Transform to display format
    return filtered.map(transformAssetForDisplay)
  })

  // Actions
  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  function setCategory(category: string) {
    selectedCategory.value = category
  }

  function setSortBy(sort: string) {
    sortBy.value = sort
  }

  function selectAsset(asset: AssetDisplayItem): UUID {
    if (import.meta.env.DEV) {
      console.log('Asset selected:', asset.id, asset.name)
    }
    return asset.id
  }

  return {
    // State
    searchQuery,
    selectedCategory,
    sortBy,

    // Computed
    availableCategories,
    contentTitle,
    filteredAssets,

    // Actions
    setSearchQuery,
    setCategory,
    setSortBy,
    selectAsset,
    transformAssetForDisplay
  }
}
