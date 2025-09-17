import { computed, ref } from 'vue'

import { t } from '@/i18n'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { formatSize } from '@/utils/formatUtil'

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
      asset.user_metadata?.description ||
      `${typeTag || t('assetBrowser.unknown')} model`

    // Format file size
    const formattedSize = formatSize(asset.size)

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
      {
        id: 'all',
        label: t('assetBrowser.allModels'),
        icon: 'icon-[lucide--folder]'
      },
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
      return t('assetBrowser.allModels')
    }

    const category = availableCategories.value.find(
      (cat) => cat.id === selectedCategory.value
    )
    return category?.label || t('assetBrowser.assets')
  })

  // Filter functions
  const filterByCategory = (category: string) => (asset: AssetItem) => {
    if (category === 'all') return true
    return asset.tags.includes(category)
  }

  const filterByQuery = (query: string) => (asset: AssetItem) => {
    if (!query) return true
    const lowerQuery = query.toLowerCase()
    return (
      asset.name.toLowerCase().includes(lowerQuery) ||
      asset.user_metadata?.description?.toLowerCase().includes(lowerQuery) ||
      asset.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    )
  }

  // Computed filtered and transformed assets
  const filteredAssets = computed(() => {
    const filtered = assets
      .filter(filterByCategory(selectedCategory.value))
      .filter(filterByQuery(searchQuery.value))

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
    selectAsset,
    transformAssetForDisplay
  }
}
