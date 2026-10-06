<script setup lang="ts">
import { ArrowUpRight, ChevronRight } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { NavColumnItem } from '@/data/mainNavigation'
import type { Locale } from '@/i18n/translations'
import NewBadge from './NewBadge.vue'

defineProps<{
  item: Pick<NavColumnItem, 'label' | 'badge' | 'external' | 'seeAll' | 'icon'>
  locale: Locale
}>()
</script>

<template>
  <span
    :class="
      cn(
        'flex items-center gap-2',
        item.seeAll && 'gap-1 font-semibold text-primary-comfy-yellow'
      )
    "
  >
    <span
      v-if="item.icon"
      :class="cn('size-4 icon-mask', item.icon)"
      aria-hidden="true"
    />
    <span class="inline-block">{{ item.label }}</span>
    <NewBadge
      v-if="item.badge"
      :locale="locale"
      size="xs"
      :label="item.badge"
    />
    <ArrowUpRight
      v-if="item.external && !item.icon"
      class="size-4 text-primary-comfy-yellow"
    />
    <ChevronRight v-if="item.seeAll" class="size-4" aria-hidden="true" />
  </span>
</template>
