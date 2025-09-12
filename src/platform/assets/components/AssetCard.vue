<template>
  <div
    data-component-id="AssetCard"
    :data-asset-id="asset.id"
    role="button"
    tabindex="0"
    :aria-label="`Select asset ${asset.name}`"
    :class="
      cn(
        'rounded-xl overflow-hidden cursor-pointer transition-all duration-200 min-w-60 max-w-64',
        'bg-ivory-100 border border-gray-300',
        'dark-theme:bg-charcoal-400 dark-theme:border-charcoal-600',
        'hover:transform hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)] hover:border-gray-400',
        'dark-theme:hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)] dark-theme:hover:border-charcoal-700',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 dark-theme:focus:ring-blue-400'
      )
    "
    @click="$emit('select', asset)"
    @keydown.enter="$emit('select', asset)"
    @keydown.space.prevent="$emit('select', asset)"
  >
    <div class="relative w-full aspect-square overflow-hidden">
      <div
        class="w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-600"
      ></div>
      <AssetBadgeGroup :badges="asset.badges" />
    </div>
    <div class="p-4">
      <h3
        :class="
          cn(
            'mb-2 m-0 text-base font-semibold overflow-hidden text-ellipsis whitespace-nowrap',
            'text-slate-800',
            'dark-theme:text-white'
          )
        "
      >
        {{ asset.name }}
      </h3>
      <p
        :class="
          cn(
            'mb-3 m-0 text-sm leading-6 overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]',
            'text-stone-300',
            'dark-theme:text-stone-200'
          )
        "
        :title="asset.description"
      >
        {{ asset.description }}
      </p>
      <div
        :class="
          cn(
            'flex gap-4 text-xs',
            'text-stone-400',
            'dark-theme:text-stone-300'
          )
        "
      >
        <span v-if="asset.stats.stars" class="flex items-center gap-1">
          <i class="pi pi-star text-xs"></i>
          {{ asset.stats.stars }}
        </span>
        <span v-if="asset.stats.downloadCount" class="flex items-center gap-1">
          <i class="pi pi-download text-xs"></i>
          {{ asset.stats.downloadCount }}
        </span>
        <span v-if="asset.stats.formattedDate" class="flex items-center gap-1">
          <i class="pi pi-clock text-xs"></i>
          {{ asset.stats.formattedDate }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import { cn } from '@/utils/tailwindUtil'

import AssetBadgeGroup from './AssetBadgeGroup.vue'

defineProps<{
  asset: AssetDisplayItem
}>()

defineEmits<{
  select: [asset: AssetDisplayItem]
}>()
</script>
