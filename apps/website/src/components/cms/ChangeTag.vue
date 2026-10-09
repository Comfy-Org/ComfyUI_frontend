<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import Badge from '@/components/ui/badge/Badge.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { QueueChange } from '@/lib/cms/queue'

const { change, locale = 'en' } = defineProps<{
  change: QueueChange
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <Badge
    variant="subtle"
    size="xs"
    :class="
      cn(
        'border text-2xs',
        change === 'new' &&
          'border-primary-comfy-yellow/40 text-primary-comfy-yellow',
        change === 'updated' && 'border-transparency-white-t20',
        change === 'removed' &&
          'border-destructive-light/40 text-destructive-light'
      )
    "
  >
    {{ t(`cmsAdmin.change.${change}`) }}
  </Badge>
</template>
