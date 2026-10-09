<script setup lang="ts">
import { ArrowRight, ArrowUpRight } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { NavColumnItem } from '@/data/mainNavigation'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import NewBadge from './NewBadge.vue'

const { locale } = defineProps<{
  item: Pick<NavColumnItem, 'label' | 'badge' | 'external' | 'icon' | 'seeAll'>
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
      }}<template v-if="item.external">
        ({{ t('nav.opensInNewTab') }})</template
      >
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
    <ArrowRight v-if="item.seeAll" class="size-4" aria-hidden="true" />
  </span>
</template>
