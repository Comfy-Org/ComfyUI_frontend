<template>
  <component
    :is="interactive ? 'button' : 'div'"
    data-component-id="AssetCard"
    :data-asset-id="asset.id"
    v-bind="elementProps"
    :class="
      cn(
        'rounded-2xl overflow-hidden transition-all duration-200 bg-modal-card-background p-2',
        interactive &&
          'group appearance-none bg-transparent m-0 outline-none cursor-pointer text-left hover:bg-secondary-background focus:bg-secondary-background border-none focus:outline-solid outline-base-foreground outline-4'
      )
    "
    @click="interactive && $emit('select', asset)"
    @keydown.enter="interactive && $emit('select', asset)"
  >
    <div class="relative aspect-square w-full overflow-hidden rounded-xl">
      <img
        v-if="shouldShowImage"
        :src="asset.preview_url"
        class="size-full object-contain"
      />
      <div
        v-else
        class="flex size-full items-center justify-center bg-gradient-to-br from-smoke-400 via-smoke-800 to-charcoal-400"
      ></div>
      <AssetBadgeGroup :badges="asset.badges" />
    </div>
    <div :class="cn('p-4 h-32 flex flex-col justify-between')">
      <div>
        <h3
          :id="titleId"
          v-tooltip.top="{ value: asset.name, showDelay: tooltipDelay }"
          :class="
            cn(
              'mb-2 m-0 text-base font-semibold line-clamp-2 wrap-anywhere',
              'text-base-foreground'
            )
          "
        >
          {{ asset.name }}
        </h3>
        <p
          :id="descId"
          v-tooltip.top="{ value: asset.description, showDelay: tooltipDelay }"
          :class="
            cn(
              'm-0 text-sm leading-6 overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]',
              'text-muted-foreground'
            )
          "
        >
          {{ asset.description }}
        </p>
      </div>
      <div :class="cn('flex gap-4 text-xs text-muted-foreground')">
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
import { useSettingStore } from '@/platform/settings/settingStore'
import { cn } from '@/utils/tailwindUtil'

const { asset, interactive } = defineProps<{
  asset: AssetDisplayItem
  interactive?: boolean
}>()

defineEmits<{
  select: [asset: AssetDisplayItem]
}>()

const settingStore = useSettingStore()

const titleId = useId()
const descId = useId()

const tooltipDelay = computed<number>(() =>
  settingStore.get('LiteGraph.Node.TooltipDelay')
)

const { error } = useImage({
  src: asset.preview_url ?? '',
  alt: asset.name
})

const shouldShowImage = computed(() => asset.preview_url && !error.value)

const elementProps = computed(() =>
  interactive
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
</script>
