import { computed, ref } from 'vue'

import { d, t } from '@/i18n'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import {
  getAssetBaseModel,
  getAssetDescription
} from '@/platform/assets/utils/assetMetadataUtils'
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
      getAssetDescription(asset) ||
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
    const baseModel = getAssetBaseModel(asset)
    if (baseModel) {
      badges.push({
        label: baseModel,
        type: 'base'
      })
    }

    // Size badge
    badges.push({ label: formattedSize, type: 'size' })

    // Create display stats from API data
    const stats = {
      formattedDate: d(new Date(asset.created_at), { dateStyle: 'short' }),
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
    const description = getAssetDescription(asset)
    return (
      asset.name.toLowerCase().includes(lowerQuery) ||
      (description && description.toLowerCase().includes(lowerQuery)) ||
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

  /**
   * Asset selection that fetches full details and executes callback with filename
   * @param assetId - The asset ID to select and fetch details for
   * @param onSelect - Optional callback to execute with the asset filename
   */
  async function selectAssetWithCallback(
    assetId: string,
    onSelect?: (filename: string) => void
  ): Promise<void> {
    // Always log selection for debugging
    if (import.meta.env.DEV) {
      console.log('Asset selected:', assetId)
    }

    // If no callback provided, just return (no need to fetch details)
    if (!onSelect) {
      return
    }

    try {
      // Fetch complete asset details to get user_metadata
      const detailAsset = await assetService.getAssetDetails(assetId)

      // Extract filename from user_metadata
      const filename = detailAsset.user_metadata?.filename

      // Validate filename exists and is not empty
      if (!filename || typeof filename !== 'string' || filename.trim() === '') {
        console.error(
          'Invalid asset filename from user_metadata:',
          filename || null,
          'for asset:',
          assetId
        )
        return
      }

      // Execute callback with validated filename
      onSelect(filename)
    } catch (error) {
      console.error(`Failed to fetch asset details for ${assetId}:`, error)
    }
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
    selectAssetWithCallback
  }
}
