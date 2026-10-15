<script setup lang="ts">
import { Image as ImageIcon } from '@lucide/vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
</script>

<template>
  <div
    class="flex min-h-80 flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
  >
    <span
      class="grid size-12 place-items-center rounded-2xl border border-dashed border-transparency-white-t20 text-primary-warm-gray"
      aria-hidden="true"
    >
      <ImageIcon class="size-5" />
    </span>
    <p class="text-sm text-primary-warm-gray">
      {{ t('workshop.output.placeholder') }}
    </p>
  </div>
</template>
