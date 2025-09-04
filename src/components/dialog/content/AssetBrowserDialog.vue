<template>
  <BaseWidgetLayout :content-title="$t('Select Checkpoint')">
    <template #header>
      <SearchBox v-model="searchQuery" class="max-w-[384px]" />
    </template>

    <template #content>
      <div class="AssetBrowserContainer flex flex-wrap gap-2">
        <CardContainer
          v-for="asset in filteredAssets"
          :key="asset.id"
          ratio="square"
          :max-width="480"
          :min-width="230"
          class="cursor-pointer hover:bg-neutral-50 dark-theme:hover:bg-neutral-850 transition-colors"
          @click="onAssetSelect(asset)"
        >
          <template #top>
            <CardTop ratio="landscape">
              <template #default>
                <div
                  class="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center"
                >
                  <i-lucide:file-archive class="text-white text-2xl" />
                </div>
              </template>
              <template #top-right>
                <IconButton
                  class="!bg-white !text-neutral-900"
                  @click.stop="() => {}"
                >
                  <i-lucide:info />
                </IconButton>
              </template>
              <template #bottom-right>
                <SquareChip :label="asset.file_type || 'ckpt'" />
                <SquareChip :label="formatFileSize(asset.file_size)" />
                <SquareChip label="Checkpoint">
                  <template #icon>
                    <i-lucide:folder />
                  </template>
                </SquareChip>
              </template>
            </CardTop>
          </template>
          <template #bottom>
            <CardBottom>
              <div class="p-2">
                <h3 class="font-medium text-sm truncate">{{ asset.name }}</h3>
                <p
                  class="text-xs text-neutral-600 dark-theme:text-neutral-400 truncate mt-1"
                >
                  {{ asset.filename }}
                </p>
              </div>
            </CardBottom>
          </template>
        </CardContainer>
      </div>

      <div
        v-if="filteredAssets.length === 0 && !assetStore.isLoading"
        class="text-center py-8"
      >
        <p class="text-neutral-500">
          {{ $t('assetBrowser.noCheckpointsFound') }}
        </p>
      </div>

      <div v-if="assetStore.isLoading" class="text-center py-8">
        <p class="text-neutral-500">
          {{ $t('assetBrowser.loadingCheckpoints') }}
        </p>
      </div>
    </template>
  </BaseWidgetLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, provide, ref, watch } from 'vue'

import IconButton from '@/components/button/IconButton.vue'
import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import SquareChip from '@/components/chip/SquareChip.vue'
import SearchBox from '@/components/input/SearchBox.vue'
import BaseWidgetLayout from '@/components/widget/layout/BaseWidgetLayout.vue'
import { useAssetStore } from '@/stores/assetStore'
import type { Asset } from '@/types/assetTypes'
import { OnCloseKey } from '@/types/widgetTypes'

const props = defineProps<{
  onClose: () => void
  onSelect?: (asset: Asset) => void
}>()

provide(OnCloseKey, props.onClose)

const assetStore = useAssetStore()
const searchQuery = ref<string>('')

const filteredAssets = computed(() => {
  return assetStore.searchAssets(searchQuery.value)
})

function formatFileSize(bytes?: number): string {
  if (!bytes) return 'Unknown'

  const sizes = ['B', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 B'

  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = (bytes / Math.pow(1024, i)).toFixed(1)

  return `${size} ${sizes[i]}`
}

function onAssetSelect(asset: Asset) {
  props.onSelect?.(asset)
  props.onClose()
}

onMounted(() => {
  void assetStore.loadCheckpointAssets()
})

watch(searchQuery, (newQuery) => {
  console.log('searchQuery:', newQuery)
})
</script>
