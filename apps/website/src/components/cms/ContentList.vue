<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
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
import type { ReadinessGap } from '@/lib/cms/readiness'

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
type Status = 'active' | 'attention' | 'archived'
const status = ref<Status>('active')
const gapFilter = ref<ReadinessGap>()
const archivedCount = rows.filter((row) => row.archived).length
const needsAttention = rows.filter((row) => row.gaps.length > 0)
const statuses = [
  { value: 'active' as const, label: t('cmsAdmin.content.active') },
  {
    value: 'attention' as const,
    label: t('cmsAdmin.content.attentionCount', {
      count: needsAttention.length
    })
  },
  {
    value: 'archived' as const,
    label: t('cmsAdmin.content.archivedCount', { count: archivedCount })
  }
]
// The most common gaps first, so the biggest clean-up is one click away.
const gapCounts = (['cover', 'summary', 'examples', 'name', 'page'] as const)
  .map((gap) => ({
    gap,
    count: needsAttention.filter((row) => row.gaps.includes(gap)).length
  }))
  .filter(({ count }) => count > 0)
  .sort((a, b) => b.count - a.count)
const inStatus = computed(() => {
  if (status.value === 'archived') return rows.filter((row) => row.archived)
  if (status.value === 'active') return rows.filter((row) => !row.archived)
  return needsAttention.filter(
    (row) => !gapFilter.value || row.gaps.includes(gapFilter.value)
  )
})
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
const emptyText = computed(() => {
  if (status.value === 'archived') return t('cmsAdmin.content.noArchived')
  if (status.value === 'attention') return t('cmsAdmin.content.allGood')
  return t('cmsAdmin.content.empty')
})
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
    <div
      v-if="status === 'attention' && gapCounts.length"
      class="grid gap-2 rounded-lg border border-admin-warning/25 bg-admin-warning/6 p-3"
    >
      <p class="text-xs text-admin-muted">
        {{ t('cmsAdmin.content.attentionHelp') }}
      </p>
      <div
        role="group"
        :aria-label="t('cmsAdmin.content.gapLabel')"
        class="flex flex-wrap gap-1.5"
      >
        <button
          v-for="{ gap, count } in gapCounts"
          :key="gap"
          type="button"
          :aria-pressed="gapFilter === gap"
          :class="
            cn(
              'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors outline-none focus-visible:outline-2 focus-visible:outline-admin-fg',
              gapFilter === gap
                ? 'border-admin-warning/60 bg-admin-warning/15 text-admin-fg'
                : 'border-admin-line text-admin-muted hover:text-admin-fg'
            )
          "
          @click="gapFilter = gapFilter === gap ? undefined : gap"
        >
          {{ t(`cmsAdmin.readiness.missing.${gap}`) }}
          <span class="text-admin-subtle tabular-nums">{{ count }}</span>
        </button>
      </div>
    </div>
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
        {{ emptyText }}
      </li>
      <ContentListRow v-for="row in visible" :key="row.uid" :row :locale />
    </ul>
  </div>
</template>
