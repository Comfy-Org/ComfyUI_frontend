import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { USER_MEDIA_ASSETS_ASSET_TYPE } from '@/platform/assets/constants/userMediaAssetsBrowse'
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import { useAssetBrowser } from '@/platform/assets/composables/useAssetBrowser'
import { useModelTypes } from '@/platform/assets/composables/useModelTypes'
import { useModelUpload } from '@/platform/assets/composables/useModelUpload'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { formatCategoryLabel } from '@/platform/assets/utils/categoryLabel'
import { useAssetsStore } from '@/stores/assetsStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

interface AssetLibraryBrowserShellProps {
  nodeType?: string
  assetType?: string
  onSelect?: (asset: AssetItem) => void
  onClose?: () => void
  showLeftPanel?: boolean
  title?: string
  overrideAssets?: AssetItem[]
}

interface AssetLibraryBrowserShellOptions {
  /** e.g. emit('asset-select', asset) from {@link AssetBrowserModal.vue} */
  onAssetSelectNotify?: (asset: AssetDisplayItem) => void
}

/**
 * Shared state for the model asset browser UI (modal and full-page route).
 * Keep behavior aligned with {@link AssetBrowserModal.vue}.
 */
export function useAssetLibraryBrowserShellState(
  props: AssetLibraryBrowserShellProps,
  options?: AssetLibraryBrowserShellOptions
) {
  const { t } = useI18n()
  const assetStore = useAssetsStore()
  const modelToNodeStore = useModelToNodeStore()
  const breakpoints = useBreakpoints(breakpointsTailwind)

  const cacheKey = computed(() => {
    if (props.nodeType) return props.nodeType
    if (props.assetType) return `tag:${props.assetType}`
    return ''
  })

  const fetchedAssets = computed(
    () => props.overrideAssets ?? assetStore.getAssets(cacheKey.value)
  )

  const isStoreLoading = computed(() =>
    assetStore.isModelLoading(cacheKey.value)
  )

  const isLoading = computed(
    () => isStoreLoading.value && fetchedAssets.value.length === 0
  )

  async function refreshAssets(): Promise<void> {
    if (props.overrideAssets) return
    if (props.nodeType) {
      await assetStore.updateModelsForNodeType(props.nodeType)
    } else if (props.assetType === USER_MEDIA_ASSETS_ASSET_TYPE) {
      await assetStore.updateUserMediaAssetsForLibrary()
    } else if (props.assetType) {
      await assetStore.updateModelsForTag(props.assetType)
    }
  }

  void refreshAssets()

  const { fetchModelTypes } = useModelTypes()
  void fetchModelTypes()

  const { isUploadButtonEnabled, showUploadDialog } =
    useModelUpload(refreshAssets)

  const {
    searchQuery,
    selectedNavItem,
    selectedCategory,
    navItems,
    categoryFilteredAssets,
    filteredAssets,
    isImportedSelected,
    updateFilters
  } = useAssetBrowser(fetchedAssets, {
    mixedAssetLibrary: props.assetType === USER_MEDIA_ASSETS_ASSET_TYPE
  })

  const focusedAsset = ref<AssetDisplayItem | null>(null)
  const isRightPanelOpen = ref(false)

  const primaryCategoryTag = computed(() => {
    if (props.assetType === USER_MEDIA_ASSETS_ASSET_TYPE) return 'all'

    const assets = fetchedAssets.value ?? []
    const tagFromAssets = assets
      .map((asset) => asset.tags?.find((tag) => tag !== 'models'))
      .find((tag): tag is string => typeof tag === 'string' && tag.length > 0)

    if (tagFromAssets) return tagFromAssets

    if (props.nodeType) {
      const mapped = modelToNodeStore.getCategoryForNodeType(props.nodeType)
      if (mapped) return mapped
    }

    if (props.assetType) return props.assetType

    return 'models'
  })

  const activeCategoryTag = computed(() => {
    if (selectedCategory.value !== 'all') {
      return selectedCategory.value
    }
    return primaryCategoryTag.value
  })

  const displayTitle = computed(() => {
    if (props.title) return props.title

    const label = formatCategoryLabel(activeCategoryTag.value)
    return t('assetBrowser.allCategory', { category: label })
  })

  const shouldShowLeftPanel = computed(() => {
    return props.showLeftPanel ?? true
  })

  const showOwnershipFilter = computed(
    () =>
      !shouldShowLeftPanel.value ||
      (selectedNavItem.value !== 'all' && selectedNavItem.value !== 'imported')
  )

  const emptyMessage = computed(() => {
    if (!isImportedSelected.value) {
      return isUploadButtonEnabled.value
        ? t('assetBrowser.noResultsCanImport')
        : undefined
    }

    return isUploadButtonEnabled.value
      ? t('assetBrowser.emptyImported.canImport')
      : t('assetBrowser.emptyImported.restricted')
  })

  function handleAssetFocus(asset: AssetDisplayItem) {
    focusedAsset.value = asset
  }

  function handleShowInfo(asset: AssetDisplayItem) {
    focusedAsset.value = asset
    isRightPanelOpen.value = true
  }

  function handleAssetSelectAndEmit(asset: AssetDisplayItem) {
    props.onSelect?.(asset)
    options?.onAssetSelectNotify?.(asset)
  }

  return {
    breakpoints,
    cacheKey,
    fetchedAssets,
    isLoading,
    refreshAssets,
    isUploadButtonEnabled,
    showUploadDialog,
    searchQuery,
    selectedNavItem,
    navItems,
    categoryFilteredAssets,
    filteredAssets,
    isImportedSelected,
    updateFilters,
    focusedAsset,
    isRightPanelOpen,
    displayTitle,
    shouldShowLeftPanel,
    showOwnershipFilter,
    emptyMessage,
    handleAssetFocus,
    handleShowInfo,
    handleAssetSelectAndEmit
  }
}
