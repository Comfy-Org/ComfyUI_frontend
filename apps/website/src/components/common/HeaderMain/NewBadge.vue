<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import Badge from '@/components/ui/badge/Badge.vue'

import type { BadgeVariants } from '@/components/ui/badge'
import type { Locale } from '../../../i18n/translations'
import { translationsFor } from '../../../i18n/translations'

const { locale, label = 'new' } = defineProps<{
  locale: Locale
  size?: BadgeVariants['size']
  label?: 'new' | 'beta'
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <Badge
    :size
    variant="accent"
    :class="
      cn(
        label === 'beta' &&
          'text-primary-warm-white before:bg-primary-comfy-plum'
      )
    "
  >
    {{ t(label === 'beta' ? 'nav.badgeBeta' : 'nav.badgeNew') }}
  </Badge>
</template>
