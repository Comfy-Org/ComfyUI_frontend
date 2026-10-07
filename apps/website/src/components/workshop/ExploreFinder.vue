<script setup lang="ts">
import { Search } from '@lucide/vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const query = defineModel<string>({ required: true })
</script>

<template>
  <label class="relative flex w-full max-w-3xl items-center">
    <span class="sr-only">{{ t('workshop.explore.searchLabel') }}</span>
    <Search
      class="pointer-events-none absolute left-5 size-5 text-primary-warm-gray"
      aria-hidden="true"
    />
    <input
      v-model="query"
      type="search"
      :placeholder="t('workshop.explore.searchPlaceholder')"
      class="h-14 w-full rounded-2xl border border-transparency-white-t8 bg-hub-surface pr-6 pl-13 text-base text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
      data-testid="explore-search"
    />
  </label>
</template>
