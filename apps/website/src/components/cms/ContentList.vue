<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { computed, ref } from 'vue'

import ContentListRow from '@/components/cms/ContentListRow.vue'
import ListingFilters from '@/components/cms/ListingFilters.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import AdminSegmented from '@/components/cms/ui/AdminSegmented.vue'
import PageHeader from '@/components/cms/ui/PageHeader.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ListingFilter } from '@/lib/cms/format'
import { kindCounts, matchesListing } from '@/lib/cms/format'
import type { ContentRow } from '@/lib/cms/queue'

const {
  rows,
  canEdit,
  locale = 'en'
} = defineProps<{
  rows: ContentRow[]
  canEdit: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const filter = ref<ListingFilter>('ALL')
const query = ref('')
const status = ref<'active' | 'archived'>('active')
const archivedCount = rows.filter((row) => row.archived).length
const statuses = [
  { value: 'active' as const, label: t('cmsAdmin.content.active') },
  {
    value: 'archived' as const,
    label: t('cmsAdmin.content.archivedCount', { count: archivedCount })
  }
]
const inStatus = computed(() =>
  rows.filter((row) => row.archived === (status.value === 'archived'))
)
const counts = computed(() => kindCounts(inStatus.value.map((row) => row.kind)))
const visible = computed(() =>
  inStatus.value.filter((row) =>
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
    >
      <template #actions>
        <AdminSegmented
          v-model="status"
          :options="statuses"
          :label="t('cmsAdmin.content.statusLabel')"
        />
        <AdminButton
          v-if="canEdit"
          href="/admin/new"
          variant="primary"
          :icon="Plus"
        >
          {{ t('cmsAdmin.content.add') }}
        </AdminButton>
      </template>
    </PageHeader>
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
        {{
          status === 'archived'
            ? t('cmsAdmin.content.noArchived')
            : t('cmsAdmin.content.empty')
        }}
      </li>
      <ContentListRow v-for="row in visible" :key="row.uid" :row :locale />
    </ul>
  </div>
</template>
