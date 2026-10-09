<script setup lang="ts">
import { computed, ref } from 'vue'

import ContentListRow from '@/components/cms/ContentListRow.vue'
import ListingFilters from '@/components/cms/ListingFilters.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ListingFilter } from '@/lib/cms/format'
import { kindCounts, matchesListing } from '@/lib/cms/format'
import type { ContentRow } from '@/lib/cms/queue'

const { rows, locale = 'en' } = defineProps<{
  rows: ContentRow[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const filter = ref<ListingFilter>('ALL')
const query = ref('')
const counts = computed(() => kindCounts(rows.map((row) => row.kind)))
const visible = computed(() =>
  rows.filter((row) =>
    matchesListing(filter.value, query.value, row.kind, [
      row.title,
      row.provider,
      row.slug
    ])
  )
)
</script>

<template>
  <div class="grid gap-5">
    <header class="max-w-2xl">
      <h1 class="text-3xl font-semibold text-primary-warm-white">
        {{ t('cmsAdmin.content.title') }}
      </h1>
      <p class="mt-2 text-primary-comfy-canvas">
        {{ t('cmsAdmin.content.help') }}
      </p>
    </header>
    <ListingFilters
      v-model:filter="filter"
      v-model:query="query"
      :counts
      :search-label="t('cmsAdmin.content.search')"
      :locale
    />
    <ul
      class="divide-y divide-transparency-white-t8 overflow-hidden rounded-2xl border border-transparency-white-t8"
    >
      <li
        v-if="visible.length === 0"
        class="px-6 py-10 text-center text-primary-comfy-canvas"
      >
        {{ t('cmsAdmin.content.empty') }}
      </li>
      <ContentListRow v-for="row in visible" :key="row.uid" :row :locale />
    </ul>
  </div>
</template>
