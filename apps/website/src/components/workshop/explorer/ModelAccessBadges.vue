<script setup lang="ts">
import { Code, Download, Play } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

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

const icons = { run: Play, api: Code, download: Download } as const
const shown = computed(() =>
  MODEL_ACCESS.filter((value) => access.includes(value))
)
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1"
    data-testid="model-access-badges"
  >
    <span
      v-for="value in shown"
      :key="value"
      :class="
        cn(
          'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-2xs font-medium whitespace-nowrap',
          value === 'download'
            ? 'bg-illustration-forest/70 text-primary-warm-white'
            : 'bg-transparency-white-t8 text-content-secondary'
        )
      "
      :data-access="value"
    >
      <component :is="icons[value]" class="size-3" aria-hidden="true" />
      {{ t(accessBadgeKey[value]) }}
    </span>
  </span>
</template>
