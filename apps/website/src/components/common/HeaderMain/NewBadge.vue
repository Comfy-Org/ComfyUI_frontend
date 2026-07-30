<script setup lang="ts">
import Badge from '@/components/ui/badge/Badge.vue'

import type { BadgeVariants } from '@/components/ui/badge'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'

defineProps<{ locale: Locale; size?: BadgeVariants['size'] }>()
</script>

<template>
  <Badge :size="size" variant="accent">
    {{ t('nav.badgeNew', locale) }}
  </Badge>
</template>
