<template>
  <BaseModalLayout
    data-component-id="AssetBrowserModal"
    class="size-full max-h-full max-w-full min-w-0"
    :content-title="displayTitle"
    @close="handleClose"
  >
    <template v-if="shouldShowLeftPanel" #leftPanel>
      <LeftSidePanel
        v-model="selectedCategory"
        data-component-id="AssetBrowserModal-LeftSidePanel"
        :nav-items="availableCategories"
      >
        <template #header-icon>
          <div class="icon-[lucide--folder] size-4" />
        </template>
        <template #header-title>
          <span class="capitalize">{{ displayTitle }}</span>
        </template>
      </LeftSidePanel>
    </template>

    <template #header>
      <SearchBox
        v-model="searchQuery"
        :autofocus="true"
        size="lg"
        :placeholder="$t('assetBrowser.searchAssetsPlaceholder')"
        class="max-w-96"
      />
    </template>

    <template #contentFilter>
      <AssetFilterBar
        :assets="categoryFilteredAssets"
        @filter-change="updateFilters"
      />
    </template>

    <template #content>
      <AssetGrid
        :assets="filteredAssets"
        :loading="isLoading"
        @asset-select="handleAssetSelectAndEmit"
      />
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import { computed, provide, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchBox from '@/components/input/SearchBox.vue'
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import LeftSidePanel from '@/components/widget/panel/LeftSidePanel.vue'
import AssetFilterBar from '@/platform/assets/components/AssetFilterBar.vue'
import AssetGrid from '@/platform/assets/components/AssetGrid.vue'
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import { useAssetBrowser } from '@/platform/assets/composables/useAssetBrowser'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import { formatCategoryLabel } from '@/platform/assets/utils/categoryLabel'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { OnCloseKey } from '@/types/widgetTypes'

const props = defineProps<{
  nodeType?: string
  inputName?: string
  onSelect?: (asset: AssetItem) => void
  onClose?: () => void
  showLeftPanel?: boolean
  title?: string
  assetType?: string
}>()

const { t } = useI18n()

const emit = defineEmits<{
  'asset-select': [asset: AssetDisplayItem]
  close: []
}>()

provide(OnCloseKey, props.onClose ?? (() => {}))

const fetchAssets = async () => {
  if (props.nodeType) {
    return (await assetService.getAssetsForNodeType(props.nodeType)) ?? []
  }

  if (props.assetType) {
    return (await assetService.getAssetsByTag(props.assetType)) ?? []
  }

  return []
}

const {
  state: fetchedAssets,
  isLoading,
  execute
} = useAsyncState<AssetItem[]>(fetchAssets, [], { immediate: false })

watch(
  () => [props.nodeType, props.assetType],
  async () => {
    await execute()
  },
  { immediate: true }
)

const {
  searchQuery,
  selectedCategory,
  availableCategories,
  categoryFilteredAssets,
  filteredAssets,
  updateFilters
} = useAssetBrowser(fetchedAssets)

const modelToNodeStore = useModelToNodeStore()

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
