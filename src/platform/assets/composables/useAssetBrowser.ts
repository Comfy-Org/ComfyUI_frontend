import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import { useFuse } from '@vueuse/integrations/useFuse'
import type { UseFuseOptions } from '@vueuse/integrations/useFuse'

import { d, t } from '@/i18n'
import type { FilterState } from '@/platform/assets/components/AssetFilterBar.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  getAssetBaseModel,
  getAssetDescription
} from '@/platform/assets/utils/assetMetadataUtils'

function filterByCategory(category: string) {
  return (asset: AssetItem) => {
    return category === 'all' || asset.tags.includes(category)
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
export function useAssetBrowser(
  assetsSource: Ref<AssetItem[] | undefined> = ref<AssetItem[] | undefined>([])
) {
  const assets = computed<AssetItem[]>(() => assetsSource.value ?? [])
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

    // Create display stats from API data
    const stats = {
      formattedDate: d(new Date(asset.created_at), { dateStyle: 'short' }),
      downloadCount: undefined, // Not available in API
      stars: undefined // Not available in API
    }

    return {
      ...asset,
      description,
      badges,
      stats
    }
  }

  const availableCategories = computed(() => {
    const categories = assets.value
      .filter((asset) => asset.tags[0] === 'models')
      .map((asset) => asset.tags[1])
      .filter((tag): tag is string => typeof tag === 'string' && tag.length > 0)

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

  // Category-filtered assets for filter options (before search/format/base model filters)
  const categoryFilteredAssets = computed(() => {
    return assets.value.filter(filterByCategory(selectedCategory.value))
  })

  const fuseOptions: UseFuseOptions<AssetItem> = {
    fuseOptions: {
      keys: [
        { name: 'name', weight: 0.4 },
        { name: 'tags', weight: 0.3 }
      ],
      threshold: 0.4, // Higher threshold for typo tolerance (0.0 = exact, 1.0 = match all)
      ignoreLocation: true, // Search anywhere in the string, not just at the beginning
      includeScore: true
    },
    matchAllWhenSearchEmpty: true
  }

  const { results: fuseResults } = useFuse(
    searchQuery,
    categoryFilteredAssets,
    fuseOptions
  )

  const searchFiltered = computed(() =>
    fuseResults.value.map((result) => result.item)
  )

  const filteredAssets = computed(() => {
    const filtered = searchFiltered.value
      .filter(filterByFileFormats(filters.value.fileFormats))
      .filter(filterByBaseModels(filters.value.baseModels))

    const sortedAssets = [...filtered]
    sortedAssets.sort((a, b) => {
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
    return sortedAssets.map(transformAssetForDisplay)
  })

  function updateFilters(newFilters: FilterState) {
    filters.value = { ...newFilters }
  }

  return {
    searchQuery,
    selectedCategory,
    availableCategories,
    contentTitle,
    categoryFilteredAssets,
    filteredAssets,
    updateFilters
  }
}
