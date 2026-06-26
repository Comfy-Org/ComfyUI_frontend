<script setup lang="ts">
import Badge from '@/components/ui/badge/Badge.vue'
import { ArrowUpRight } from '@lucide/vue'

import type { NavColumnItem } from '../../../data/mainNavigation'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'

defineProps<{ item: NavColumnItem; locale: Locale }>()
</script>

<template>
  <span class="flex items-center gap-2">
    <span class="ppformula-text-center">{{ item.label }}</span>
    <Badge v-if="item.badge" size="xs" variant="accent">
      {{ t('nav.badgeNew', locale) }}
    </Badge>
    <ArrowUpRight
      v-if="item.external"
      class="text-primary-comfy-yellow size-4"
    />
  </span>
</template>
