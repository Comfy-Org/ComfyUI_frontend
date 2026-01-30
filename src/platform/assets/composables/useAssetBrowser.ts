import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import { useFuse } from '@vueuse/integrations/useFuse'
import type { UseFuseOptions } from '@vueuse/integrations/useFuse'
import { storeToRefs } from 'pinia'

import { d, t } from '@/i18n'
import type {
  FilterState,
  OwnershipOption
} from '@/platform/assets/components/AssetFilterBar.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  getAssetBaseModels,
  getAssetDisplayName,
  getAssetFilename
} from '@/platform/assets/utils/assetMetadataUtils'
import { useAssetDownloadStore } from '@/stores/assetDownloadStore'
import type { NavGroupData, NavItemData } from '@/types/navTypes'

type NavId = 'all' | 'imported' | (string & {})

function filterByCategory(category: string) {
  return (asset: AssetItem) => {
    if (category === 'all') return true

    // Check if any tag matches the category (for exact matches)
    if (asset.tags.includes(category)) return true

    // Check if any tag's top-level folder matches the category
    return asset.tags.some((tag) => {
      if (typeof tag === 'string' && tag.includes('/')) {
        return tag.split('/')[0] === category
      }
      return false
    })
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
    const assetBaseModels = getAssetBaseModels(asset)
    return assetBaseModels.some((model) => modelSet.has(model))
  }
}

function filterByOwnership(ownership: OwnershipOption) {
  return (asset: AssetItem) => {
    if (ownership === 'all') return true
    if (ownership === 'my-models') return asset.is_immutable === false
    if (ownership === 'public-models') return asset.is_immutable === true
    return true
  }
}

type AssetBadge = {
  label: string
  type: 'type' | 'base' | 'size'
}

// Display properties for transformed assets
export interface AssetDisplayItem extends AssetItem {
  secondaryText: string
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
  const assetDownloadStore = useAssetDownloadStore()
  const { sessionDownloadCount } = storeToRefs(assetDownloadStore)

  // State
  const searchQuery = ref('')
  const selectedNavItem = ref<NavId>('all')
  const filters = ref<FilterState>({
    sortBy: 'recent',
    fileFormats: [],
    baseModels: [],
    ownership: 'all'
  })

  const selectedOwnership = computed<OwnershipOption>(() => {
    if (selectedNavItem.value === 'imported') return 'my-models'
    return filters.value.ownership
  })

  const selectedCategory = computed(() => {
    if (
      selectedNavItem.value === 'all' ||
      selectedNavItem.value === 'imported'
    ) {
      return 'all'
    }
    return selectedNavItem.value
  })

  // Transform API asset to display asset
  function transformAssetForDisplay(asset: AssetItem): AssetDisplayItem {
    const secondaryText = getAssetFilename(asset)

    const badges: AssetBadge[] = []

    const typeTag = asset.tags.find((tag) => tag !== 'models')
    // Type badge from non-root tag
    if (typeTag) {
      // Remove category prefix from badge label (e.g. "checkpoint/model" → "model")
      const badgeLabel = typeTag.includes('/')
        ? typeTag.substring(typeTag.indexOf('/') + 1)
        : typeTag

      badges.push({ label: badgeLabel, type: 'type' })
    }

    // Base model badges from metadata
    const baseModels = getAssetBaseModels(asset)
    for (const model of baseModels) {
      badges.push({ label: model, type: 'base' })
    }

    // Create display stats from API data
    const stats = {
      formattedDate: asset.created_at
        ? d(new Date(asset.created_at), { dateStyle: 'short' })
        : undefined,
      downloadCount: undefined, // Not available in API
      stars: undefined // Not available in API
    }

    return {
      ...asset,
      secondaryText,
      badges,
      stats
    }
  }

  const typeCategories = computed<NavItemData[]>(() => {
    const categories = assets.value
      .filter((asset) => asset.tags[0] === 'models')
      .map((asset) => asset.tags[1])
      .filter((tag): tag is string => typeof tag === 'string' && tag.length > 0)
      .map((tag) => tag.split('/')[0])

    return Array.from(new Set(categories))
      .sort()
      .map((category) => ({
        id: category,
        label: category.charAt(0).toUpperCase() + category.slice(1),
        icon: 'icon-[lucide--folder]'
      }))
  })

  const navItems = computed<(NavItemData | NavGroupData)[]>(() => {
    const quickFilters: NavItemData[] = [
      {
        id: 'all',
        label: t('assetBrowser.allModels'),
        icon: 'icon-[lucide--list]'
      },
      {
        id: 'imported',
        label: t('assetBrowser.imported'),
        icon: 'icon-[lucide--folder-input]',
        badge:
          sessionDownloadCount.value > 0
            ? sessionDownloadCount.value
            : undefined
      }
    ]

    if (typeCategories.value.length === 0) {
      return quickFilters
    }

    return [
      ...quickFilters,
      {
        title: t('assetBrowser.byType'),
        items: typeCategories.value,
        collapsible: false
      }
    ]
  })

  const isImportedSelected = computed(
    () => selectedNavItem.value === 'imported'
  )

  // Compute content title from selected nav item
  const contentTitle = computed(() => {
    if (selectedNavItem.value === 'all') {
      return t('assetBrowser.allModels')
    }
    if (selectedNavItem.value === 'imported') {
      return t('assetBrowser.imported')
    }

    const category = typeCategories.value.find(
      (cat) => cat.id === selectedNavItem.value
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
        { name: 'tags', weight: 0.3 },
        { name: 'user_metadata.name', weight: 0.4 },
        { name: 'user_metadata.additional_tags', weight: 0.3 },
        { name: 'user_metadata.trained_words', weight: 0.3 },
        { name: 'user_metadata.user_description', weight: 0.3 },
        { name: 'metadata.name', weight: 0.4 },
        { name: 'metadata.trained_words', weight: 0.3 }
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
      .filter(filterByOwnership(selectedOwnership.value))

    const sortedAssets = [...filtered]
    sortedAssets.sort((a, b) => {
      switch (filters.value.sortBy) {
        case 'name-desc':
          return getAssetDisplayName(b).localeCompare(getAssetDisplayName(a))
        case 'recent':
          return (
            new Date(b.created_at ?? 0).getTime() -
            new Date(a.created_at ?? 0).getTime()
          )
        case 'name-asc':
        default:
          return getAssetDisplayName(a).localeCompare(getAssetDisplayName(b))
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
    selectedNavItem,
    selectedCategory,
    navItems,
    contentTitle,
    categoryFilteredAssets,
    filteredAssets,
    isImportedSelected,
    updateFilters
  }
}
