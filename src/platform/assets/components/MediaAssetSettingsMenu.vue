<template>
  <div class="flex flex-col">
    <Button
      variant="textonly"
      class="w-full"
      @click="viewMode = MEDIA_ASSET_VIEW_MODE.list"
    >
      <span class="flex items-center gap-2">
        <i class="icon-[lucide--table-of-contents] size-4" />
        <span>{{ $t('sideToolbar.queueProgressOverlay.viewList') }}</span>
      </span>
      <i
        class="ml-auto icon-[lucide--check] size-4"
        :class="viewMode !== MEDIA_ASSET_VIEW_MODE.list && 'opacity-0'"
      />
    </Button>

    <Button
      variant="textonly"
      class="w-full"
      @click="viewMode = MEDIA_ASSET_VIEW_MODE.gridSmall"
    >
      <span class="flex items-center gap-2">
        <i class="icon-[lucide--grid-3x3] size-4" />
        <span>{{ $t('sideToolbar.mediaAssets.viewGridSmall') }}</span>
      </span>
      <i
        class="ml-auto icon-[lucide--check] size-4"
        :class="viewMode !== MEDIA_ASSET_VIEW_MODE.gridSmall && 'opacity-0'"
      />
    </Button>

    <Button
      variant="textonly"
      class="w-full"
      @click="viewMode = MEDIA_ASSET_VIEW_MODE.grid"
    >
      <span class="flex items-center gap-2">
        <i class="icon-[lucide--layout-grid] size-4" />
        <span>{{ $t('sideToolbar.mediaAssets.viewGridLarge') }}</span>
      </span>
      <i
        class="ml-auto icon-[lucide--check] size-4"
        :class="viewMode !== MEDIA_ASSET_VIEW_MODE.grid && 'opacity-0'"
      />
    </Button>

    <template v-if="showSortOptions">
      <div class="my-1 w-full border-b border-border-subtle" />

      <Button
        v-for="option in mediaAssetSortOptions"
        :key="option.label"
        variant="textonly"
        class="w-full"
        @click="sortBy = option.value"
      >
        <span>{{ $t(option.label) }}</span>
        <i
          class="ml-auto icon-[lucide--check] size-4"
          :class="!isEqual(sortBy, option.value) && 'opacity-0'"
        />
      </Button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { isEqual } from 'es-toolkit'

import Button from '@/components/ui/button/Button.vue'

import { mediaAssetSortOptions } from '@/platform/assets/mediaAssetSortOptions'
import type { MediaAssetSort } from '@/platform/assets/mediaAssetSortOptions'

import { MEDIA_ASSET_VIEW_MODE } from './mediaAssetViewOptions'
import type { MediaAssetViewMode } from './mediaAssetViewOptions'

const { showSortOptions = false } = defineProps<{
  showSortOptions?: boolean
}>()

const viewMode = defineModel<MediaAssetViewMode>('viewMode', { required: true })
const sortBy = defineModel<MediaAssetSort>('sortBy', { required: true })
</script>
