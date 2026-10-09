<script setup lang="ts">
import { computed, ref } from 'vue'

import ContentListRow from '@/components/cms/ContentListRow.vue'
import ListingFilters from '@/components/cms/ListingFilters.vue'
import PageHeader from '@/components/cms/ui/PageHeader.vue'
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
    <PageHeader
      :title="t('cmsAdmin.content.title')"
      :description="t('cmsAdmin.content.help')"
    />
    <ListingFilters
      v-model:filter="filter"
      v-model:query="query"
      :counts
      :search-label="t('cmsAdmin.content.search')"
      :locale
    />
    <ul class="overflow-hidden rounded-lg border border-admin-line">
      <li
        v-if="visible.length === 0"
        class="px-6 py-10 text-center text-xs text-admin-muted"
      >
        {{ t('cmsAdmin.content.empty') }}
      </li>
      <ContentListRow v-for="row in visible" :key="row.uid" :row :locale />
    </ul>
  </div>
</template>
