<script setup lang="ts">
import { ArrowRight, ArrowUpRight, ChevronRight } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { NavColumnItem } from '@/data/mainNavigation'
import type { Locale } from '@/i18n/translations'
import NavItemThumb from './NavItemThumb.vue'
import NewBadge from './NewBadge.vue'

const { item, lead = false } = defineProps<{
  item: Pick<
    NavColumnItem,
    'label' | 'badge' | 'external' | 'seeAll' | 'thumbnail' | 'meta'
  >
  locale: Locale
  /** A see-all link that leads somewhere broader, marked with an arrow. */
  lead?: boolean
}>()
</script>

<template>
  <span
    v-if="item.meta !== undefined || item.thumbnail"
    class="flex min-w-0 items-center gap-3 font-normal tracking-normal"
  >
    <NavItemThumb :src="item.thumbnail" :name="item.label" />
    <span class="flex min-w-0 flex-col gap-0.5">
      <span class="truncate text-base text-primary-warm-white">
        {{ item.label }}
      </span>
      <span
        v-if="item.meta"
        class="truncate text-xs text-primary-warm-gray"
        data-testid="nav-item-meta"
      >
        {{ item.meta }}
      </span>
    </span>
  </span>
  <span
    v-else
    :class="
      cn(
        'flex items-center gap-2',
        item.seeAll && 'gap-1 font-semibold text-primary-comfy-yellow'
      )
    "
  >
    <span class="inline-block">{{ item.label }}</span>
    <NewBadge
      v-if="item.badge"
      :locale="locale"
      size="xs"
      :label="item.badge"
    />
    <ArrowUpRight
      v-if="item.external"
      class="size-4 text-primary-comfy-yellow"
    />
    <ArrowRight v-if="item.seeAll && lead" class="size-4" aria-hidden="true" />
    <ChevronRight v-else-if="item.seeAll" class="size-4" aria-hidden="true" />
  </span>
</template>
