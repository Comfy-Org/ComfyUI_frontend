<script setup lang="ts">
import { Eye } from '@lucide/vue'
import { computed, ref } from 'vue'

import DraftLists from '@/components/cms/DraftLists.vue'
import FinalReviewDialog from '@/components/cms/FinalReviewDialog.vue'
import ListingFilters from '@/components/cms/ListingFilters.vue'
import RejectDialog from '@/components/cms/RejectDialog.vue'
import ReviewSheet from '@/components/cms/ReviewSheet.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import AdminSegmented from '@/components/cms/ui/AdminSegmented.vue'
import PageHeader from '@/components/cms/ui/PageHeader.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ListingFilter } from '@/lib/cms/format'
import { kindCounts, matchesListing } from '@/lib/cms/format'
import type { QueueItem, SubmissionQueueItem } from '@/lib/cms/queue'
import type { Staging, StageStatus } from '@/lib/cms/stage-status'
import { postDecision } from '@/lib/cms/stage-client'
import { STAGE_STATUSES, stageOf } from '@/lib/cms/stage-status'

const {
  items,
  staging = {},
  stagingSaved = false,
  csrf,
  canApply,
  canEdit = false,
  draftId,
  generation,
  locale = 'en'
} = defineProps<{
  items: QueueItem[]
  staging?: Staging
  /** Whether decisions are kept by the API; otherwise they live in the page. */
  stagingSaved?: boolean
  csrf: string
  canApply: boolean
  canEdit?: boolean
  draftId: number
  generation: number
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const decisions = ref<Staging>({ ...staging })
const stageFor = (item: QueueItem) => stageOf(decisions.value, item.id)
const inStatus = (status: StageStatus) =>
  items.filter((item) => stageFor(item).status === status)
const counts = computed(() =>
  Object.fromEntries(
    STAGE_STATUSES.map((status) => [status, inStatus(status).length])
  )
)
const tab = ref<StageStatus>(
  counts.value.NEW > 0 || counts.value.APPROVED === 0 ? 'NEW' : 'APPROVED'
)
const tabs = computed(() =>
  STAGE_STATUSES.map((status) => ({
    value: status,
    label: t(`cmsAdmin.stage.tab.${status}`, { count: counts.value[status] })
  }))
)

const filter = ref<ListingFilter>('ALL')
const query = ref('')
const openId = ref<string>()
const reviewing = ref(false)
const rejecting = ref<SubmissionQueueItem[]>([])
const failed = ref(false)

const inTab = computed(() => inStatus(tab.value))
const kinds = computed(() => kindCounts(inTab.value.map((item) => item.kind)))
const shown = computed(() =>
  inTab.value.filter((item) =>
    matchesListing(filter.value, query.value, item.kind, [
      item.title,
      item.source === 'submission' ? item.author : item.provider,
      item.source === 'submission' ? item.shareId : item.slug
    ])
  )
)
const shownSubmissions = computed(() =>
  shown.value.filter((item) => item.source === 'submission')
)
const shownChanges = computed(() =>
  shown.value.filter((item) => item.source === 'catalog')
)
// The sheet steps through rows in the order the page shows them.
const visible = computed(() => [
  ...shownSubmissions.value,
  ...shownChanges.value
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
const approved = computed(() => inStatus('APPROVED'))
// Like the catalog API, the final review waits until nothing is left to review.
const canFinish = computed(
  () => canApply && counts.value.NEW === 0 && approved.value.length > 0
)
const guidance = computed(() => {
  if (counts.value.NEW > 0) return t('cmsAdmin.stage.guide.review')
  if (approved.value.length > 0)
    return t(
      'cmsAdmin.stage.guide.ready',
      { count: approved.value.length },
      approved.value.length
    )
  return undefined
})

async function decide(changes: QueueItem[], status: StageStatus) {
  const before = decisions.value
  decisions.value = {
    ...before,
    ...Object.fromEntries(changes.map((item) => [item.id, { status }]))
  }
  failed.value = false
  if (!stagingSaved) return
  const ids = changes.map((item) => item.id)
  if (await postDecision(csrf, ids, status)) return
  decisions.value = before
  failed.value = true
}
// Deciding in the panel moves on to the next change still in this tab.
function decideOpen(status: StageStatus) {
  const item = openItem.value
  if (!item) return
  const next =
    visible.value[openIndex.value + 1] ?? visible.value[openIndex.value - 1]
  void decide([item], status)
  openId.value = next?.id
}
function step(direction: -1 | 1) {
  openId.value = visible.value[openIndex.value + direction]?.id
}
function rejectOpen() {
  if (openItem.value?.source === 'submission')
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
          :disabled="!canFinish"
          @click="reviewing = true"
        >
          {{
            t(
              'cmsAdmin.finalReview.open',
              { count: approved.length },
              approved.length
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
    <p
      v-if="failed"
      role="alert"
      class="rounded-lg border border-admin-danger/30 bg-admin-danger/10 px-3 py-2 text-xs text-admin-danger-text"
    >
      {{ t('cmsAdmin.stage.failed') }}
    </p>

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
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <AdminSegmented
          v-model="tab"
          :options="tabs"
          :label="t('cmsAdmin.stage.tabLabel')"
        />
        <p v-if="guidance" class="text-xs text-admin-muted">{{ guidance }}</p>
      </div>
      <ListingFilters
        v-model:filter="filter"
        v-model:query="query"
        :counts="kinds"
        :search-label="t('cmsAdmin.draft.search')"
        :locale
      />
      <DraftLists
        :tab
        :in-tab-count="inTab.length"
        :submissions="shownSubmissions"
        :changes="shownChanges"
        :stage-of="stageFor"
        :open-id="openId"
        :can-apply="canApply"
        :locale
        @decide="decide"
        @reject="rejecting = $event"
        @open="openId = $event"
      />
    </template>

    <ReviewSheet
      v-if="openItem"
      v-model:open="sheetOpen"
      :item="openItem"
      :stage="stageFor(openItem)"
      :index="openIndex"
      :total="visible.length"
      :can-apply="canApply"
      :can-edit="canEdit"
      :csrf
      :locale
      @decide="decideOpen"
      @step="step"
      @reject="rejectOpen"
    />
    <FinalReviewDialog
      v-model:open="reviewing"
      :items="approved"
      :later-count="counts.DEFERRED"
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
