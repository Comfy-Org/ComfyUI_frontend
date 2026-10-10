<script setup lang="ts">
import { Eye } from '@lucide/vue'
import { computed, ref } from 'vue'

import DraftContentChanges from '@/components/cms/DraftContentChanges.vue'
import DraftSubmissions from '@/components/cms/DraftSubmissions.vue'
import DraftSummary from '@/components/cms/DraftSummary.vue'
import ListingFilters from '@/components/cms/ListingFilters.vue'
import PublishDialog from '@/components/cms/PublishDialog.vue'
import RejectDialog from '@/components/cms/RejectDialog.vue'
import ReviewSheet from '@/components/cms/ReviewSheet.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import PageHeader from '@/components/cms/ui/PageHeader.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ListingFilter } from '@/lib/cms/format'
import { isFuture, kindCounts, matchesListing } from '@/lib/cms/format'
import type {
  CatalogQueueItem,
  QueueItem,
  SubmissionQueueItem
} from '@/lib/cms/queue'

const {
  items,
  csrf,
  canApply,
  canEdit = false,
  draftId,
  generation,
  locale = 'en'
} = defineProps<{
  items: QueueItem[]
  csrf: string
  canApply: boolean
  canEdit?: boolean
  draftId: number
  generation: number
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const filter = ref<ListingFilter>('ALL')
const query = ref('')
// A submission goes live only once someone approves it; the rest keep waiting.
const approvedIds = ref(new Set<string>())
const openId = ref<string>()
const publishing = ref(false)
const rejecting = ref<SubmissionQueueItem[]>([])

const isSubmission = (item: QueueItem): item is SubmissionQueueItem =>
  item.source === 'submission'
const isCatalog = (item: QueueItem): item is CatalogQueueItem =>
  item.source === 'catalog'
const isApproved = (item: QueueItem) => approvedIds.value.has(item.id)

const submissions = computed(() => items.filter(isSubmission))
const catalog = computed(() => items.filter(isCatalog))
const included = computed(() =>
  items.filter((item) => isCatalog(item) || isApproved(item))
)
const undecided = computed(() =>
  submissions.value.filter((item) => !isApproved(item))
)
const flagged = computed(
  () => catalog.value.filter((item) => item.gaps.length > 0).length
)
const scheduled = computed(
  () => catalog.value.filter((item) => isFuture(item.visibleFrom)).length
)
const counts = computed(() => kindCounts(items.map((item) => item.kind)))
const matches = (item: QueueItem) =>
  matchesListing(filter.value, query.value, item.kind, [
    item.title,
    isSubmission(item) ? item.author : item.provider,
    isSubmission(item) ? item.shareId : item.slug
  ])
const shownSubmissions = computed(() => submissions.value.filter(matches))
const shownCatalog = computed(() => catalog.value.filter(matches))
// The sheet steps through rows in the order the page shows them.
const visible = computed<QueueItem[]>(() => [
  ...shownSubmissions.value,
  ...shownCatalog.value
])
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

function setApproved(items: QueueItem[], value: boolean) {
  const next = new Set(approvedIds.value)
  for (const item of items)
    if (value) next.add(item.id)
    else next.delete(item.id)
  approvedIds.value = next
}
function step(direction: -1 | 1) {
  openId.value = visible.value[openIndex.value + direction]?.id
}
function rejectOpen() {
  if (openItem.value && isSubmission(openItem.value))
    rejecting.value = [openItem.value]
}
</script>

<template>
  <div class="grid gap-5">
    <PageHeader
      :title="t('cmsAdmin.draft.title')"
      :description="t('cmsAdmin.draft.help')"
    >
      <template #actions>
        <AdminButton
          v-if="items.length > 0"
          href="/hub/models/?preview=DRAFT&changes=open"
          target="_blank"
          rel="noopener"
          :icon="Eye"
        >
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

    <DraftSummary
      :undecided="undecided.length"
      :flagged
      :scheduled
      :publishing="included.length"
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

    <template v-else>
      <ListingFilters
        v-model:filter="filter"
        v-model:query="query"
        :counts
        :search-label="t('cmsAdmin.draft.search')"
        :locale
      />
      <p
        v-if="visible.length === 0"
        class="rounded-lg border border-admin-line px-6 py-10 text-center text-xs text-admin-muted"
      >
        {{ t('cmsAdmin.draft.noMatches') }}
      </p>

      <DraftSubmissions
        v-if="shownSubmissions.length"
        :items="shownSubmissions"
        :approved-ids="approvedIds"
        :open-id="openId"
        :can-apply="canApply"
        :locale
        @approve="setApproved"
        @reject="rejecting = $event"
        @open="openId = $event"
      />
      <DraftContentChanges
        v-if="shownCatalog.length"
        :items="shownCatalog"
        :open-id="openId"
        :can-apply="canApply"
        :locale
        @open="openId = $event"
      />
    </template>

    <ReviewSheet
      v-if="openItem"
      v-model:open="sheetOpen"
      :approved="isApproved(openItem)"
      :item="openItem"
      :index="openIndex"
      :total="visible.length"
      :can-apply="canApply"
      :can-edit="canEdit"
      :csrf
      :locale
      @update:approved="setApproved([openItem], $event)"
      @step="step"
      @reject="rejectOpen"
    />
    <PublishDialog
      v-model:open="publishing"
      :items="included"
      :held-count="undecided.length"
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
