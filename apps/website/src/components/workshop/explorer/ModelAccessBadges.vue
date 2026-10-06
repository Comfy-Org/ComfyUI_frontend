<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ModelAccess } from '@/lib/workshop/explorer/model-access'
import {
  accessBadgeKey,
  MODEL_ACCESS
} from '@/lib/workshop/explorer/model-access'

const { access, locale = 'en' } = defineProps<{
  access: readonly ModelAccess[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const shown = computed(() =>
  MODEL_ACCESS.filter((value) => access.includes(value))
)
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1.5"
    data-testid="model-access-badges"
  >
    <span
      v-for="value in shown"
      :key="value"
      class="inline-flex h-6 w-fit shrink-0 items-center justify-center rounded-full bg-hub-surface px-3 py-1 text-xs font-normal whitespace-nowrap text-content"
      :data-access="value"
      data-testid="model-access-badge"
    >
      {{ t(accessBadgeKey[value]) }}
    </span>
  </span>
</template>
