<template>
  <BaseModalLayout
    v-model:right-panel-open="isRightPanelOpen"
    data-component-id="AssetBrowserModal"
    class="size-full max-h-full max-w-full min-w-0"
    :content-title="displayTitle"
    :right-panel-title="$t('assetBrowser.modelInfo.title')"
    @close="handleClose"
  >
    <template v-if="shouldShowLeftPanel" #leftPanelHeaderTitle>
      <i class="icon-[comfy--ai-model] size-4" />
      <h2 class="flex-auto text-base font-semibold text-nowrap select-none">
        {{ displayTitle }}
      </h2>
    </template>
    <template v-if="shouldShowLeftPanel" #leftPanel>
      <LeftSidePanel
        v-model="selectedNavItem"
        data-component-id="AssetBrowserModal-LeftSidePanel"
        :nav-items
      />
    </template>

    <template #header>
      <div
        :ref="primeVueOverlay.overlayScopeRef"
        class="flex w-full items-center justify-between gap-2"
        @click.self="focusedAsset = null"
      >
        <SearchInput
          v-model="searchQuery"
          :autofocus="true"
          size="lg"
          :placeholder="$t('g.searchPlaceholder', { subject: '' })"
          class="max-w-lg flex-1"
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
        :show-ownership-filter
        :content-style="selectContentStyle"
        @filter-change="updateFilters"
        @click.self="focusedAsset = null"
      />
    </template>

    <template #content>
      <AssetGrid
        :assets="filteredAssets"
        :loading="isLoading"
        :focused-asset-id="focusedAsset?.id"
        :empty-message
        @asset-focus="handleAssetFocus"
        @asset-select="handleAssetSelectAndEmit"
        @asset-deleted="refreshAssets"
        @asset-show-info="handleShowInfo"
        @click="focusedAsset = null"
      />
    </template>

    <template #rightPanel>
      <ModelInfoPanel
        v-if="focusedAsset"
        :asset="focusedAsset"
        :cache-key
        :select-content-style="selectContentStyle"
      />
      <div
        v-else
        class="flex h-full items-center justify-center p-6 text-center wrap-break-word text-muted"
      >
        {{ $t('assetBrowser.modelInfo.selectModelPrompt') }}
      </div>
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { provide } from 'vue'

import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Button from '@/components/ui/button/Button.vue'
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import LeftSidePanel from '@/components/widget/panel/LeftSidePanel.vue'
import { usePrimeVueOverlayChildStyle } from '@/composables/usePopoverSizing'
import AssetFilterBar from '@/platform/assets/components/AssetFilterBar.vue'
import AssetGrid from '@/platform/assets/components/AssetGrid.vue'
import ModelInfoPanel from '@/platform/assets/components/modelInfo/ModelInfoPanel.vue'
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import { useAssetLibraryBrowserShellState } from '@/platform/assets/composables/library/useAssetLibraryBrowserShellState'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { OnCloseKey } from '@/types/widgetTypes'

const {
  nodeType,
  assetType,
  onSelect,
  onClose,
  showLeftPanel,
  title,
  overrideAssets
} = defineProps<{
  nodeType?: string
  assetType?: string
  onSelect?: (asset: AssetItem) => void
  onClose?: () => void
  showLeftPanel?: boolean
  title?: string
  overrideAssets?: AssetItem[]
}>()

const emit = defineEmits<{
  'asset-select': [asset: AssetDisplayItem]
  close: []
}>()

provide(OnCloseKey, onClose ?? (() => {}))

const primeVueOverlay = usePrimeVueOverlayChildStyle()
const selectContentStyle = primeVueOverlay.contentStyle

const {
  breakpoints,
  cacheKey,
  isLoading,
  refreshAssets,
  isUploadButtonEnabled,
  showUploadDialog,
  searchQuery,
  selectedNavItem,
  navItems,
  categoryFilteredAssets,
  filteredAssets,
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
} = useAssetLibraryBrowserShellState(
  {
    nodeType,
    assetType,
    onSelect,
    onClose,
    showLeftPanel,
    title,
    overrideAssets
  },
  {
    onAssetSelectNotify: (asset) => emit('asset-select', asset)
  }
)

function handleClose() {
  onClose?.()
  emit('close')
}
</script>
