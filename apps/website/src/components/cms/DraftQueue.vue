<script setup lang="ts">
import { Eye } from '@lucide/vue'
import { computed, ref } from 'vue'

import DraftStats from '@/components/cms/DraftStats.vue'
import ListingFilters from '@/components/cms/ListingFilters.vue'
import PublishDialog from '@/components/cms/PublishDialog.vue'
import QueueRow from '@/components/cms/QueueRow.vue'
import RejectDialog from '@/components/cms/RejectDialog.vue'
import ReviewSheet from '@/components/cms/ReviewSheet.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import PageHeader from '@/components/cms/ui/PageHeader.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ListingFilter } from '@/lib/cms/format'
import { isFuture, kindCounts, matchesListing } from '@/lib/cms/format'
import type { QueueItem, SubmissionQueueItem } from '@/lib/cms/queue'

const {
  items,
  csrf,
  canApply,
  draftId,
  generation,
  locale = 'en'
} = defineProps<{
  items: QueueItem[]
  csrf: string
  canApply: boolean
  draftId: number
  generation: number
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const filter = ref<ListingFilter>('ALL')
const query = ref('')
const excluded = ref(new Set<string>())
const openId = ref<string>()
const publishing = ref(false)
const rejecting = ref<SubmissionQueueItem[]>([])

const submissions = computed(() =>
  items.filter(
    (item): item is SubmissionQueueItem => item.source === 'submission'
  )
)
const isIncluded = (item: QueueItem) => !excluded.value.has(item.id)
const included = computed(() => items.filter(isIncluded))
const held = computed(() =>
  submissions.value.filter((item) => !isIncluded(item))
)
const scheduled = computed(
  () =>
    included.value.filter(
      (item) => item.source === 'catalog' && isFuture(item.visibleFrom)
    ).length
)
const counts = computed(() => kindCounts(items.map((item) => item.kind)))
const visible = computed(() =>
  items.filter((item) =>
    matchesListing(filter.value, query.value, item.kind, [
      item.title,
      item.source === 'submission' ? item.author : item.provider,
      item.source === 'submission' ? item.shareId : item.slug
    ])
  )
)
const openIndex = computed(() =>
  visible.value.findIndex((item) => item.id === openId.value)
)
const openItem = computed(() => visible.value[openIndex.value])
const sheetOpen = computed({
  get: () => openItem.value !== undefined,
  set: (value) => {
    if (!value) openId.value = undefined
  }
})
const includeAllState = computed(() => {
  if (held.value.length === 0) return true
  return held.value.length === submissions.value.length
    ? false
    : 'indeterminate'
})
const heldTitles = computed(() =>
  held.value.map((item) => item.title).join(', ')
)

function setIncluded(item: QueueItem, value: boolean) {
  const next = new Set(excluded.value)
  if (value) next.delete(item.id)
  else next.add(item.id)
  excluded.value = next
}
function setAllIncluded(value: boolean) {
  excluded.value = new Set(
    value ? [] : submissions.value.map((item) => item.id)
  )
}
function step(direction: -1 | 1) {
  openId.value = visible.value[openIndex.value + direction]?.id
}
function rejectOpen() {
  if (openItem.value?.source === 'submission')
    rejecting.value = [openItem.value]
}
const canToggle = (item: QueueItem) => canApply && item.source === 'submission'
</script>

<template>
  <div class="grid gap-5">
    <PageHeader
      :title="t('cmsAdmin.draft.title')"
      :description="t('cmsAdmin.draft.help')"
    >
      <template #actions>
        <AdminButton href="/hub/models/?preview=DRAFT" :icon="Eye">
          {{ t('cmsAdmin.previewDraft') }}
        </AdminButton>
        <AdminButton
          variant="primary"
          :disabled="!canApply || included.length === 0"
          @click="publishing = true"
        >
          {{
            t(
              'cmsAdmin.draft.publish',
              { count: included.length },
              included.length
            )
          }}
        </AdminButton>
      </template>
    </PageHeader>

    <p
      v-if="!canApply"
      class="rounded-lg border border-admin-info/25 bg-admin-info/10 px-3 py-2 text-xs text-admin-fg"
    >
      {{ t('cmsAdmin.applyOnly') }}
    </p>

    <DraftStats
      :waiting="items.length"
      :included="included.length"
      :held="held.length"
      :scheduled
      :locale
    />

    <div
      v-if="held.length"
      class="flex flex-wrap items-center gap-2 rounded-lg border border-admin-warning/25 bg-admin-warning/10 py-1.5 pr-1.5 pl-3 text-xs"
    >
      <span class="mr-auto">
        {{
          t('cmsAdmin.draft.heldBar', {
            count: held.length,
            titles: heldTitles
          })
        }}
      </span>
      <AdminButton variant="ghost" size="sm" @click="setAllIncluded(true)">
        {{ t('cmsAdmin.draft.includeAgain') }}
      </AdminButton>
      <AdminButton variant="dangerGhost" size="sm" @click="rejecting = held">
        {{
          t('cmsAdmin.draft.rejectHeld', { count: held.length }, held.length)
        }}
      </AdminButton>
    </div>

    <ListingFilters
      v-model:filter="filter"
      v-model:query="query"
      :counts
      :search-label="t('cmsAdmin.draft.search')"
      :locale
    />

    <div
      v-if="items.length === 0"
      class="grid justify-items-center gap-1 rounded-lg border border-dashed border-admin-line px-6 py-14 text-center"
    >
      <p class="text-sm font-medium">{{ t('cmsAdmin.draft.emptyTitle') }}</p>
      <p class="text-xs text-admin-muted">
        {{ t('cmsAdmin.draft.emptyBody') }}
      </p>
    </div>

    <div
      v-else
      role="table"
      class="overflow-hidden rounded-lg border border-admin-line"
    >
      <div
        role="row"
        class="grid min-h-10 grid-cols-[1rem_3.5rem_minmax(0,1fr)_1rem] items-center gap-3 border-b border-admin-line bg-admin-card px-4 text-xs font-medium tracking-[0.06em] text-admin-muted uppercase md:grid-cols-[1rem_3.5rem_minmax(0,1fr)_11rem_10rem_1rem]"
      >
        <span role="columnheader">
          <Checkbox
            :model-value="includeAllState"
            :disabled="!canApply || submissions.length === 0"
            :aria-label="t('cmsAdmin.draft.includeAll')"
            @update:model-value="setAllIncluded($event === true)"
          />
        </span>
        <span role="columnheader" />
        <span role="columnheader">
          {{ t('cmsAdmin.draft.columns.change') }}
        </span>
        <span role="columnheader" class="hidden md:block">
          {{ t('cmsAdmin.draft.columns.from') }}
        </span>
        <span role="columnheader" class="hidden md:block">
          {{ t('cmsAdmin.draft.columns.appears') }}
        </span>
        <span role="columnheader" />
      </div>
      <p
        v-if="visible.length === 0"
        class="px-6 py-10 text-center text-xs text-admin-muted"
      >
        {{ t('cmsAdmin.draft.noMatches') }}
      </p>
      <QueueRow
        v-for="item in visible"
        :key="item.id"
        :item
        :included="isIncluded(item)"
        :active="openId === item.id"
        :can-toggle="canToggle(item)"
        :locale
        @update:included="setIncluded(item, $event)"
        @open="openId = item.id"
      />
    </div>

    <ReviewSheet
      v-if="openItem"
      v-model:open="sheetOpen"
      :included="isIncluded(openItem)"
      :item="openItem"
      :index="openIndex"
      :total="visible.length"
      :can-apply="canApply"
      :locale
      @update:included="setIncluded(openItem, $event)"
      @step="step"
      @reject="rejectOpen"
    />
    <PublishDialog
      v-model:open="publishing"
      :items="included"
      :held-count="held.length"
      :csrf
      :draft-id="draftId"
      :generation
      :locale
    />
    <RejectDialog
      :open="rejecting.length > 0"
      :items="rejecting"
      :csrf
      :locale
      @update:open="!$event && (rejecting = [])"
    />
  </div>
</template>
