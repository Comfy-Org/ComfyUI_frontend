<template>
  <component
    :is="interactive ? 'button' : 'div'"
    data-component-id="AssetCard"
    :data-asset-id="asset.id"
    v-bind="elementProps"
    :class="
      cn(
        // Base layout and container styles (always applied)
        'rounded-xl overflow-hidden transition-all duration-200',
        interactive && 'group',
        // Button-specific styles
        interactive && [
          'appearance-none bg-transparent p-0 m-0 font-inherit text-inherit outline-none cursor-pointer text-left',
          'bg-interface-panel-card-surface',
          'hover:bg-interface-panel-card-surface-hover',
          'border-none',
          'focus:outline-solid outline-blue-100 outline-4'
        ],
        // Div-specific styles
        !interactive && 'bg-interface-panel-card-surface'
      )
    "
    @click="interactive && $emit('select', asset)"
    @keydown.enter="interactive && $emit('select', asset)"
  >
    <div class="relative aspect-square w-full overflow-hidden">
      <div
        class="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-600"
      ></div>
      <AssetBadgeGroup :badges="asset.badges" />
    </div>
    <div :class="cn('p-4 h-32 flex flex-col justify-between')">
      <div>
        <h3
          :class="
            cn(
              'mb-2 m-0 text-base font-semibold overflow-hidden text-ellipsis whitespace-nowrap',
              'text-text-primary'
            )
          "
        >
          {{ asset.name }}
        </h3>
        <p
          :class="
            cn(
              'm-0 text-sm leading-6 overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]',
              'text-text-secondary'
            )
          "
          :title="asset.description"
        >
          {{ asset.description }}
        </p>
      </div>
      <div :class="cn('flex gap-4 text-xs', 'text-text-secondary')">
        <span v-if="asset.stats.stars" class="flex items-center gap-1">
          <i class="icon-[lucide--star] size-3" />
          {{ asset.stats.stars }}
        </span>
        <span v-if="asset.stats.downloadCount" class="flex items-center gap-1">
          <i class="icon-[lucide--download] size-3" />
          {{ asset.stats.downloadCount }}
        </span>
        <span v-if="asset.stats.formattedDate" class="flex items-center gap-1">
          <i class="icon-[lucide--clock] size-3" />
          {{ asset.stats.formattedDate }}
        </span>
      </div>
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import AssetBadgeGroup from '@/platform/assets/components/AssetBadgeGroup.vue'
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import { cn } from '@/utils/tailwindUtil'

const props = defineProps<{
  asset: AssetDisplayItem
  interactive?: boolean
}>()

const elementProps = computed(() =>
  props.interactive
    ? {
        type: 'button',
        'aria-label': `Select asset ${props.asset.name}`
      }
    : {}
)

defineEmits<{
  select: [asset: AssetDisplayItem]
}>()
</script>
