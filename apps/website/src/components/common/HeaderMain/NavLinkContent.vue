<script setup lang="ts">
import { ArrowUpRight } from '@lucide/vue'

import type { NavColumnItem } from '../../../data/mainNavigation'
import type { Locale } from '../../../i18n/translations'
import NewBadge from './NewBadge.vue'

defineProps<{
  item: Pick<NavColumnItem, 'label' | 'badge' | 'external'>
  locale: Locale
}>()
</script>

<template>
  <span class="flex items-center gap-2">
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
  </span>
</template>
