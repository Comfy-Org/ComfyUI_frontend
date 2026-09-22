<script setup lang="ts">
import { Search, X } from '@lucide/vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { placeholder, locale = 'en' } = defineProps<{
  /** Named per half, because the two are searched apart. */
  placeholder: string
  locale?: Locale
}>()

const query = defineModel<string>({ required: true })
</script>

<template>
  <div class="relative min-w-56 flex-1 sm:w-96 sm:flex-none">
    <Search
      class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-content-muted"
      aria-hidden="true"
    />
    <!-- The browser draws its own clear button in its own colours, which over
      a dark field reads as somebody else's. -->
    <input
      id="catalogue-search"
      v-model="query"
      type="search"
      :placeholder
      :aria-label="placeholder"
      class="h-11 w-full rounded-2xl bg-transparency-white-t4 ps-9 pe-10 text-sm text-content transition-colors outline-none hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 [&::-webkit-search-cancel-button]:hidden"
    />
    <button
      v-if="query"
      type="button"
      class="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer rounded-lg text-primary-warm-gray transition-colors outline-none hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
      :aria-label="t('workshop.search.clear', locale)"
      data-testid="catalogue-search-clear"
      @click="query = ''"
    >
      <X class="size-4" aria-hidden="true" />
    </button>
  </div>
</template>
