<template>
  <BaseModalLayout
    data-component-id="AssetBrowserModal"
    class="size-full max-h-full max-w-full min-w-0"
    :content-title="displayTitle"
    @close="handleClose"
  >
    <template v-if="shouldShowLeftPanel" #leftPanel>
      <LeftSidePanel
        v-model="selectedNavItem"
        data-component-id="AssetBrowserModal-LeftSidePanel"
        :nav-items
      >
        <template #header-icon>
          <div class="icon-[comfy--ai-model] size-4" />
        </template>
        <template #header-title>
          <span class="capitalize">{{ displayTitle }}</span>
        </template>
      </LeftSidePanel>
    </template>

    <template #header>
      <div class="flex w-full items-center justify-between gap-2">
        <SearchBox
          v-model="searchQuery"
          :autofocus="true"
          size="lg"
          :placeholder="$t('g.searchPlaceholder')"
          class="max-w-96"
        />
        <Button
          v-if="isUploadButtonEnabled"
          variant="primary"
          :size="breakpoints.md ? 'lg' : 'icon'"
          data-attr="upload-model-button"
          @click="showUploadDialog"
        >
          <i class="icon-[lucide--folder-input]" />
          <span class="hidden md:inline">{{
            $t('assetBrowser.uploadModel')
          }}</span>
        </Button>
      </div>
    </template>

    <template #contentFilter>
      <AssetFilterBar
        :assets="categoryFilteredAssets"
        :all-assets="fetchedAssets"
        @filter-change="updateFilters"
      />
    </template>

    <template #content>
      <AssetGrid
        :assets="filteredAssets"
        :loading="isLoading"
        @asset-select="handleAssetSelectAndEmit"
        @asset-deleted="refreshAssets"
      />
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed, provide } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchBox from '@/components/common/SearchBox.vue'
import Button from '@/components/ui/button/Button.vue'
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import LeftSidePanel from '@/components/widget/panel/LeftSidePanel.vue'
import AssetFilterBar from '@/platform/assets/components/AssetFilterBar.vue'
import AssetGrid from '@/platform/assets/components/AssetGrid.vue'
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import { useAssetBrowser } from '@/platform/assets/composables/useAssetBrowser'
import { useModelUpload } from '@/platform/assets/composables/useModelUpload'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { formatCategoryLabel } from '@/platform/assets/utils/categoryLabel'
import { useAssetsStore } from '@/stores/assetsStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { OnCloseKey } from '@/types/widgetTypes'

const { t } = useI18n()
const assetStore = useAssetsStore()
const modelToNodeStore = useModelToNodeStore()
const breakpoints = useBreakpoints(breakpointsTailwind)

const props = defineProps<{
  nodeType?: string
  assetType?: string
  onSelect?: (asset: AssetItem) => void
  onClose?: () => void
  showLeftPanel?: boolean
  title?: string
}>()

const emit = defineEmits<{
  'asset-select': [asset: AssetDisplayItem]
  close: []
}>()

provide(OnCloseKey, props.onClose ?? (() => {}))

// Compute the cache key based on nodeType or assetType
const cacheKey = computed(() => {
  if (props.nodeType) return props.nodeType
  if (props.assetType) return `tag:${props.assetType}`
  return ''
})

// Read directly from store cache - reactive to any store updates
const fetchedAssets = computed(() => assetStore.getAssets(cacheKey.value))

const isStoreLoading = computed(() => assetStore.isModelLoading(cacheKey.value))

// Only show loading spinner when loading AND no cached data
const isLoading = computed(
  () => isStoreLoading.value && fetchedAssets.value.length === 0
)

async function refreshAssets(): Promise<AssetItem[]> {
  if (props.nodeType) {
    return await assetStore.updateModelsForNodeType(props.nodeType)
  }
  if (props.assetType) {
    return await assetStore.updateModelsForTag(props.assetType)
  }
  return []
}

// Trigger background refresh on mount
void refreshAssets()

const { isUploadButtonEnabled, showUploadDialog } =
  useModelUpload(refreshAssets)

const {
  searchQuery,
  selectedNavItem,
  selectedCategory,
  navItems,
  categoryFilteredAssets,
  filteredAssets,
  updateFilters
} = useAssetBrowser(fetchedAssets)

const primaryCategoryTag = computed(() => {
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

function handleClose() {
  props.onClose?.()
  emit('close')
}

function handleAssetSelectAndEmit(asset: AssetDisplayItem) {
  emit('asset-select', asset)
  // onSelect callback is provided by dialog composable layer
  // It handles the appropriate transformation (filename extraction or full asset)
  props.onSelect?.(asset)
}
</script>
