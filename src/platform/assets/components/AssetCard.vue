<template>
  <component
    :is="interactive ? 'button' : 'div'"
    data-component-id="AssetCard"
    :data-asset-id="asset.id"
    v-bind="elementProps"
    :class="cardClasses"
    @click="interactive && $emit('select', asset)"
    @keydown.enter="interactive && $emit('select', asset)"
  >
    <div class="relative aspect-square w-full overflow-hidden rounded-xl">
      <img
        v-if="shouldShowImage"
        :src="asset.preview_url"
        class="h-full w-full object-contain"
      />
      <div
        v-else
        class="flex h-full w-full items-center justify-center bg-gradient-to-br from-smoke-400 via-smoke-800 to-charcoal-400"
      ></div>
      <AssetBadgeGroup :badges="asset.badges" />
    </div>
    <div :class="cn('p-4 h-32 flex flex-col justify-between')">
      <div>
        <h3
          :id="titleId"
          :class="
            cn(
              'mb-2 m-0 text-base font-semibold line-clamp-2 wrap-anywhere',
              'text-base-foreground'
            )
          "
          :title="asset.name"
        >
          {{ asset.name }}
        </h3>
        <p
          :id="descId"
          :class="
            cn(
              'm-0 text-sm leading-6 overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]',
              'text-ash-500',
              'dark-theme:text-slate-100'
            )
          "
          :title="asset.description"
        >
          {{ asset.description }}
        </p>
      </div>
      <div
        :class="
          cn('flex gap-4 text-xs', 'text-stone-400', 'dark-theme:text-ash-300')
        "
      >
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
import { useImage } from '@vueuse/core'
import { computed, useId } from 'vue'

import AssetBadgeGroup from '@/platform/assets/components/AssetBadgeGroup.vue'
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import { cn } from '@/utils/tailwindUtil'

const props = defineProps<{
  asset: AssetDisplayItem
  interactive?: boolean
}>()

const titleId = useId()
const descId = useId()

const { error } = useImage({
  src: props.asset.preview_url ?? '',
  alt: props.asset.name
})

const shouldShowImage = computed(() => props.asset.preview_url && !error.value)

const cardClasses = computed(() => {
  const base = [
    'rounded-xl',
    'overflow-hidden',
    'transition-all',
    'duration-200'
  ]

  if (!props.interactive) {
    return cn(...base, 'bg-smoke-100 dark-theme:bg-charcoal-800')
  }

  return cn(
    ...base,
    'group',
    'appearance-none bg-transparent p-0 m-0',
    'font-inherit text-inherit outline-none cursor-pointer text-left',
    'bg-smoke-100 dark-theme:bg-charcoal-800',
    'hover:bg-secondary-background',
    'border-none',
    'focus:outline-solid outline-azure-600 outline-4'
  )
})

const elementProps = computed(() =>
  props.interactive
    ? {
        type: 'button',
        'aria-labelledby': titleId,
        'aria-describedby': descId
      }
    : {
        'aria-labelledby': titleId,
        'aria-describedby': descId
      }
)

defineEmits<{
  select: [asset: AssetDisplayItem]
}>()
</script>
