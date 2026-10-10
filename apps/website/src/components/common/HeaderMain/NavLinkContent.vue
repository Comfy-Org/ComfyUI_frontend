<script setup lang="ts">
import { ArrowUpRight } from '@lucide/vue'

import type { NavColumnItem } from '@/data/mainNavigation'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import NewBadge from './NewBadge.vue'

const { locale } = defineProps<{
  item: Pick<NavColumnItem, 'label' | 'badge' | 'external' | 'newTab' | 'icon'>
  locale: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <span v-if="item.icon" class="flex items-center">
    <span
      class="block size-5 icon-mask"
      :style="{ maskImage: `url('${item.icon}')` }"
      aria-hidden="true"
    />
    <span class="sr-only">
      {{ item.label
      }}<template v-if="item.external || item.newTab">
        ({{ t('nav.opensInNewTab') }})</template
      >
    </span>
  </span>
  <span v-else class="flex items-center gap-2">
    <span class="inline-block">{{ item.label }}</span>
    <NewBadge
      v-if="item.badge"
      :locale="locale"
      size="xs"
      :label="item.badge"
    />
    <ArrowUpRight
      v-if="item.external || item.newTab"
      data-testid="opens-in-new-tab"
      class="size-4 text-primary-comfy-yellow"
    />
  </span>
</template>
