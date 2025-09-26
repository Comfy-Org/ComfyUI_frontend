import { computed, ref } from 'vue'

import { d, t } from '@/i18n'
import type { FilterState } from '@/platform/assets/components/AssetFilterBar.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetFilenameSchema } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import {
  getAssetBaseModel,
  getAssetDescription
} from '@/platform/assets/utils/assetMetadataUtils'
import { formatSize } from '@/utils/formatUtil'

function filterByCategory(category: string) {
  return (asset: AssetItem) => {
    return category === 'all' || asset.tags.includes(category)
  }
}

function filterByQuery(query: string) {
  return (asset: AssetItem) => {
    if (!query) return true
    const lowerQuery = query.toLowerCase()
    const description = getAssetDescription(asset)
    return (
      asset.name.toLowerCase().includes(lowerQuery) ||
      (description && description.toLowerCase().includes(lowerQuery)) ||
      asset.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    )
  }
}

function filterByFileFormats(formats: string[]) {
  return (asset: AssetItem) => {
    if (formats.length === 0) return true
    const formatSet = new Set(formats)
    const extension = asset.name.split('.').pop()?.toLowerCase()
    return extension ? formatSet.has(extension) : false
  }
}

function filterByBaseModels(models: string[]) {
  return (asset: AssetItem) => {
    if (models.length === 0) return true
    const modelSet = new Set(models)
    const baseModel = getAssetBaseModel(asset)
    return baseModel ? modelSet.has(baseModel) : false
  }
}

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
  const filters = ref<FilterState>({
    sortBy: 'name-asc',
    fileFormats: [],
    baseModels: []
  })

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

  const availableCategories = computed(() => {
    const categories = assets
      .filter((asset) => asset.tags[0] === 'models' && asset.tags[1])
      .map((asset) => asset.tags[1])

    const uniqueCategories = Array.from(new Set(categories))
      .sort()
      .map((category) => ({
        id: category,
        label: category.charAt(0).toUpperCase() + category.slice(1),
        icon: 'icon-[lucide--package]'
      }))

    return [
      {
        id: 'all',
        label: t('assetBrowser.allModels'),
        icon: 'icon-[lucide--folder]'
      },
      ...uniqueCategories
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

  const filteredAssets = computed(() => {
    const filtered = assets
      .filter(filterByCategory(selectedCategory.value))
      .filter(filterByQuery(searchQuery.value))
      .filter(filterByFileFormats(filters.value.fileFormats))
      .filter(filterByBaseModels(filters.value.baseModels))

    // Sort assets
    filtered.sort((a, b) => {
      switch (filters.value.sortBy) {
        case 'name-desc':
          return b.name.localeCompare(a.name)
        case 'recent':
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        case 'popular':
          return a.name.localeCompare(b.name)
        case 'name-asc':
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
    if (import.meta.env.DEV) {
      console.debug('Asset selected:', assetId)
    }

    if (!onSelect) {
      return
    }

    try {
      const detailAsset = await assetService.getAssetDetails(assetId)
      const filename = detailAsset.user_metadata?.filename
      const validatedFilename = assetFilenameSchema.safeParse(filename)
      if (!validatedFilename.success) {
        console.error(
          'Invalid asset filename:',
          validatedFilename.error.errors,
          'for asset:',
          assetId
        )
        return
      }

      onSelect(validatedFilename.data)
    } catch (error) {
      console.error(`Failed to fetch asset details for ${assetId}:`, error)
    }
  }

  function updateFilters(newFilters: FilterState) {
    filters.value = { ...newFilters }
  }

  return {
    searchQuery,
    selectedCategory,
    availableCategories,
    contentTitle,
    filteredAssets,
    selectAssetWithCallback,
    updateFilters
  }
}
