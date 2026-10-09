<script setup lang="ts">
import { Search } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ListingFilter } from '@/lib/cms/format'
import { LISTING_KINDS } from '@/lib/cms/format'

const {
  counts,
  searchLabel,
  locale = 'en'
} = defineProps<{
  counts: Record<ListingFilter, number>
  searchLabel: string
  locale?: Locale
}>()
const filter = defineModel<ListingFilter>('filter', { required: true })
const query = defineModel<string>('query', { required: true })
const { t } = translationsFor(locale)
const options = ['ALL', ...LISTING_KINDS] as const
const label = (option: ListingFilter) =>
  option === 'ALL'
    ? t('cmsAdmin.draft.all')
    : t(`cmsAdmin.draft.filter.${option}`)
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <div
      role="group"
      :aria-label="t('cmsAdmin.draft.filterLabel')"
      class="flex flex-wrap gap-2"
    >
      <button
        v-for="option in options"
        :key="option"
        type="button"
        :aria-pressed="filter === option"
        :class="
          cn(
            'rounded-full border px-3 py-1 text-sm transition-colors',
            filter === option
              ? 'border-primary-warm-white text-primary-warm-white'
              : 'border-transparency-white-t20 text-primary-comfy-canvas hover:text-primary-warm-white'
          )
        "
        @click="filter = option"
      >
        {{ label(option) }}
        <span class="ml-1 text-xs text-primary-comfy-canvas tabular-nums">{{
          counts[option]
        }}</span>
      </button>
    </div>
    <label class="relative ml-auto w-full sm:w-72">
      <span class="sr-only">{{ searchLabel }}</span>
      <Search
        class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary-comfy-canvas"
        aria-hidden="true"
      />
      <input
        v-model="query"
        type="search"
        :placeholder="searchLabel"
        class="w-full rounded-full border border-transparency-white-t20 bg-site-bg-soft py-2 pr-4 pl-9 text-sm outline-none focus-visible:border-primary-comfy-yellow"
      />
    </label>
  </div>
</template>
