<script setup lang="ts">
import { ArrowUpRight } from '@lucide/vue'

import type { NavColumnItem } from '../../../data/mainNavigation'
import type { Locale } from '../../../i18n/translations'
import NewBadge from './NewBadge.vue'

defineProps<{ item: NavColumnItem; locale: Locale }>()
</script>

<template>
  <span class="flex items-center gap-2">
    <span class="ppformula-text-center">{{ item.label }}</span>
    <NewBadge v-if="item.badge" :locale="locale" size="xs" />
    <ArrowUpRight
      v-if="item.external"
      class="text-primary-comfy-yellow size-4"
    />
  </span>
</template>
