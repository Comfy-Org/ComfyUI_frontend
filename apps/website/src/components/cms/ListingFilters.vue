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
      class="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-admin-field p-0.5"
    >
      <button
        v-for="option in options"
        :key="option"
        type="button"
        :aria-pressed="filter === option"
        :class="
          cn(
            'inline-flex h-6.5 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-admin-fg',
            filter === option
              ? 'bg-admin-selected text-admin-fg'
              : 'text-admin-muted hover:text-admin-fg'
          )
        "
        @click="filter = option"
      >
        {{ label(option) }}
        <span class="text-admin-subtle tabular-nums">{{ counts[option] }}</span>
      </button>
    </div>
    <label class="relative ml-auto w-full sm:w-64">
      <span class="sr-only">{{ searchLabel }}</span>
      <Search
        class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-admin-muted"
        aria-hidden="true"
      />
      <input
        v-model="query"
        type="search"
        :placeholder="searchLabel"
        class="h-8 w-full rounded-lg border border-admin-field bg-transparent pr-3 pl-8 text-xs text-admin-fg outline-none placeholder:text-admin-subtle hover:border-ash-800 focus-visible:border-admin-control"
      />
    </label>
  </div>
</template>
