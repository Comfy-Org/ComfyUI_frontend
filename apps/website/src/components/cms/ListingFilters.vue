<script setup lang="ts">
import { Search } from '@lucide/vue'
import { computed } from 'vue'

import AdminSelect from '@/components/cms/ui/AdminSelect.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ListingFilter } from '@/lib/cms/format'
import { LISTING_KINDS } from '@/lib/cms/format'

/** A list's views on the left (slot), then its type filter and search on the right. */
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
const options = computed(() =>
  (['ALL', ...LISTING_KINDS] as const).map((value) => ({
    value,
    label: `${
      value === 'ALL'
        ? t('cmsAdmin.draft.allTypes')
        : t(`cmsAdmin.draft.filter.${value}`)
    } (${counts[value]})`
  }))
)
</script>

<template>
  <div
    class="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-admin-line"
  >
    <slot />
    <div class="flex w-full items-center gap-2 pb-2 sm:w-auto">
      <div
        class="w-40 shrink-0 [&_button]:h-8 [&_button]:py-0 [&_button]:text-xs"
      >
        <AdminSelect
          v-model="filter"
          :options
          :label="t('cmsAdmin.draft.filterLabel')"
        />
      </div>
      <label class="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
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
  </div>
</template>
