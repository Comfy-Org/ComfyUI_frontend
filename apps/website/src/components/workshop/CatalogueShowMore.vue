<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  shown,
  total,
  locale = 'en'
} = defineProps<{
  shown: number
  total: number
  locale?: Locale
}>()
const { t } = translationsFor(locale)

defineEmits<{ more: [] }>()
</script>

<template>
  <div class="mt-10 flex flex-col items-center gap-4 max-sm:mt-8">
    <p
      class="text-sm text-primary-warm-gray tabular-nums"
      data-testid="catalogue-show-more-count"
    >
      {{ t('workshop.hub.showingOf', { shown, total }) }}
    </p>
    <button
      type="button"
      class="group flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-transparency-white-t8 px-8 py-4 text-sm font-medium text-primary-comfy-canvas transition-colors outline-none hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
      data-testid="catalogue-show-more"
      @click="$emit('more')"
    >
      {{ t('workshop.hub.showMore') }}
      <ChevronDown
        class="size-4 transition-transform group-hover:translate-y-0.5"
        aria-hidden="true"
      />
    </button>
  </div>
</template>
