<script setup lang="ts">
import { computed, ref } from 'vue'
import { DialogRoot, DialogTitle, DialogDescription } from 'reka-ui'
import CatalogAdminShell from '@/components/cms/layout/CatalogAdminShell.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import AdminDialogContent from '@/components/cms/ui/AdminDialogContent.vue'
import DraftQueue from '@/components/cms/DraftQueue.vue'
import CatalogCheckedReceiptDialog from './CatalogCheckedReceiptDialog.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { StagingReview } from '@/lib/cms/staging-review'
import {
  checkedReviewPayload,
  discardPayload,
  reviewFilter,
  reviewTypes,
  stagingSnapshot,
  unfiltered
} from '@/lib/cms/staging-review'
import { matchesReviewReceipt, reviewReceipt } from '@/lib/cms/review-receipt'
import type { ReviewReceipt } from '@/lib/cms/review-receipt'
import { reviewRequest } from '@/lib/cms/staging-client'
import { canonicalQueue } from '@/lib/cms/canonical-queue'
import { reviewFieldErrors } from '@/lib/cms/review-errors'
import ReviewFailure from './ReviewFailure.vue'

const {
  initial,
  csrf,
  canApply,
  canEdit,
  locale = 'en'
} = defineProps<{
  initial: StagingReview
  csrf: string
  canApply: boolean
  canEdit: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)
type Flow =
  | { kind: 'ready'; snapshot: StagingReview }
  | { kind: 'loading' | 'saving'; snapshot: StagingReview }
  | {
      kind: 'failed'
      snapshot: StagingReview
      reason: 'stale' | 'failed' | 'dependency' | 'publicationDependency'
      fields?: ReturnType<typeof reviewFieldErrors>
    }
  | { kind: 'discard'; snapshot: StagingReview; uids: string[]; key: string }
  | {
      kind: 'final'
      snapshot: StagingReview
      receipt: ReviewReceipt
      uids: string[]
      trigger?: HTMLElement
    }
const flow = ref<Flow>({ kind: 'ready', snapshot: initial })
const selected = ref(new Set<string>())
const acknowledgeAll = ref(false)
const form = ref({
  search: initial.filter.search ?? '',
  author: initial.filter.author_uid ?? '',
  changeID: initial.filter.change_id ?? '',
  tags: initial.filter.tags?.join(', ') ?? '',
  type: initial.filter.types?.[0] ?? ''
})
const queue = computed(() => canonicalQueue(flow.value.snapshot.items))
const finalChanges = computed(() => {
  const current = flow.value
  if (current.kind !== 'final') return []
  const checked = new Set(current.uids)
  return current.snapshot.items.filter((item) => checked.has(item.content.uid))
})
const blocked = computed(() => flow.value.kind !== 'ready')
const busy = computed(
  () => flow.value.kind === 'loading' || flow.value.kind === 'saving'
)
const requiresAcknowledgement = computed(
  () =>
    unfiltered(flow.value.snapshot.filter) &&
    selected.value.size === flow.value.snapshot.items.length &&
    selected.value.size > 0
)
const discardBlocked = computed(
  () =>
    blocked.value ||
    !canEdit ||
    !selected.value.size ||
    selected.value.size > 100 ||
    (requiresAcknowledgement.value && !acknowledgeAll.value)
)
const inputClass =
  'w-full rounded-lg border border-admin-field bg-admin-chrome px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-admin-fg'

function selectMany(uids: string[]) {
  if (blocked.value || (!canApply && !canEdit)) return
  if (
    new Set(uids).size !== uids.length ||
    uids.some(
      (uid) =>
        !flow.value.snapshot.items.some((item) => item.content.uid === uid)
    )
  )
    return
  selected.value = new Set(uids)
  acknowledgeAll.value = false
}
async function reload() {
  if (
    busy.value ||
    flow.value.kind === 'final' ||
    flow.value.kind === 'discard'
  )
    return
  const filter = selectedFilter()
  if (!filter.success) return
  const previous = flow.value.snapshot
  flow.value = { kind: 'loading', snapshot: previous }
  const result = await reviewRequest('staging', { filter: filter.data })
  acceptReload(result, previous)
}
function selectedFilter() {
  return reviewFilter.safeParse({
    ...(form.value.search.trim() ? { search: form.value.search.trim() } : {}),
    ...(form.value.author.trim()
      ? { author_uid: form.value.author.trim() }
      : {}),
    ...(form.value.tags.trim()
      ? { tags: form.value.tags.split(',').map((tag) => tag.trim()) }
      : {}),
    ...(form.value.type ? { types: [form.value.type] } : {}),
    ...(form.value.changeID ? { change_id: form.value.changeID } : {})
  })
}
function acceptReload(
  result: Awaited<ReturnType<typeof reviewRequest>>,
  previous: StagingReview
) {
  const snapshot = result.ok ? stagingSnapshot(result.data) : undefined
  flow.value = snapshot
    ? { kind: 'ready', snapshot }
    : { kind: 'failed', snapshot: previous, reason: 'failed' }
  if (snapshot) {
    selected.value = new Set()
    acknowledgeAll.value = false
  }
}
async function review(event: MouseEvent) {
  if (blocked.value || !canApply || !selected.value.size) return
  const snapshot = flow.value.snapshot
  const uids = [...selected.value]
  const trigger =
    event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined
  flow.value = { kind: 'loading', snapshot }
  const result = await reviewRequest('review-receipt', {
    csrf,
    body: JSON.stringify(checkedReviewPayload(snapshot, uids))
  })
  const receipt = result.ok ? reviewReceipt(result.data) : undefined
  flow.value =
    receipt && (await matchesReviewReceipt(snapshot, receipt, uids))
      ? { kind: 'final', snapshot, receipt, uids, trigger }
      : {
          kind: 'failed',
          snapshot,
          reason: reviewFailureReason(result, Boolean(receipt)),
          fields: result.status === 422 ? reviewFieldErrors(result.data) : []
        }
}
function reviewFailureReason(
  result: Awaited<ReturnType<typeof reviewRequest>>,
  hasReceipt: boolean
) {
  if (result.status === 409 || (result.ok && hasReceipt)) return 'stale'
  return result.status === 422 ? 'publicationDependency' : 'failed'
}
function requestDiscard(uids: string[]) {
  if (
    blocked.value ||
    !canEdit ||
    !uids.length ||
    uids.length > 100 ||
    new Set(uids).size !== uids.length ||
    uids.some(
      (uid) =>
        !flow.value.snapshot.items.some((item) => item.content.uid === uid)
    )
  )
    return
  flow.value = {
    kind: 'discard',
    snapshot: flow.value.snapshot,
    uids,
    key: crypto.randomUUID()
  }
}
function closeDialog() {
  if (flow.value.kind === 'discard' || flow.value.kind === 'final')
    flow.value = { kind: 'ready', snapshot: flow.value.snapshot }
}
async function discard() {
  if (flow.value.kind !== 'discard' || !canEdit) return
  const pending = flow.value
  flow.value = { kind: 'saving', snapshot: pending.snapshot }
  const result = await reviewRequest('discard-changes', {
    csrf,
    key: pending.key,
    body: JSON.stringify(discardPayload(pending.snapshot, pending.uids))
  })
  if (!result.ok || !stagingSnapshot(result.data)) {
    flow.value = {
      kind: 'failed',
      snapshot: pending.snapshot,
      reason: discardFailureReason(result.status),
      fields: result.status === 422 ? reviewFieldErrors(result.data) : []
    }
    return
  }
  const current = await reviewRequest('staging', {
    filter: pending.snapshot.filter
  })
  acceptReload(current, pending.snapshot)
}
function discardFailureReason(status: number) {
  if (status === 409) return 'stale'
  return status === 422 ? 'dependency' : 'failed'
}
async function exit() {
  if (blocked.value) return
  const snapshot = flow.value.snapshot
  flow.value = { kind: 'loading', snapshot }
  const result = await reviewRequest('exit', { csrf })
  if (result.ok) window.location.assign('/hub/models/')
  else flow.value = { kind: 'failed', snapshot, reason: 'failed' }
}
</script>

<template>
  <CatalogAdminShell
    current="draft"
    :navigation="[{ key: 'draft', href: '/admin/catalog' }]"
    :draft-count="flow.snapshot.items.length"
    :live-revision="flow.snapshot.state.live_rev"
    :busy="blocked"
    :locale
    @open-live="exit"
  >
    <ReviewFailure
      v-if="flow.kind === 'failed'"
      :reason="flow.reason"
      :fields="flow.fields"
      :locale
    />
    <DraftQueue
      :items="queue"
      :csrf
      :can-apply="canApply"
      :can-edit="canEdit"
      :draft-id="flow.snapshot.state.draft_rev"
      :generation="flow.snapshot.state.draft_generation"
      :selected-uids="[...selected]"
      :busy="blocked"
      controlled
      :locale
      @selection="selectMany"
      @review="review"
      @discard="(uid) => requestDiscard([uid])"
    >
      <template #actions>
        <AdminButton
          v-if="canEdit"
          href="/admin/content/new"
          :disabled="blocked"
          >{{ t('cccStaging.addContent') }}</AdminButton
        >
        <AdminButton
          v-if="canEdit"
          variant="dangerGhost"
          :disabled="discardBlocked"
          @click="requestDiscard([...selected])"
          >{{ t('cccStaging.deleteChanges') }}</AdminButton
        >
      </template>
      <template #filters>
        <details>
          <summary class="w-fit cursor-pointer text-xs text-admin-muted">
            {{ t('cccStaging.applyFilters') }}
          </summary>
          <form
            class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
            @submit.prevent="reload"
          >
            <fieldset
              :disabled="blocked && flow.kind !== 'failed'"
              class="contents"
            >
              <label class="text-xs text-admin-muted"
                >{{ t('cccStaging.search')
                }}<input
                  v-model="form.search"
                  maxlength="300"
                  :class="inputClass"
              /></label>
              <label class="text-xs text-admin-muted"
                >{{ t('cccStaging.originalAuthor')
                }}<input v-model="form.author" :class="inputClass"
              /></label>
              <label class="text-xs text-admin-muted"
                >{{ t('cccStaging.tags')
                }}<input v-model="form.tags" :class="inputClass"
              /></label>
              <label class="text-xs text-admin-muted"
                >{{ t('cccChecked.changeID')
                }}<input
                  v-model="form.changeID"
                  maxlength="128"
                  pattern="[A-Za-z0-9][A-Za-z0-9._-]*"
                  :class="inputClass"
              /></label>
              <label class="text-xs text-admin-muted"
                >{{ t('cccStaging.type')
                }}<select v-model="form.type" :class="inputClass">
                  <option value="">{{ t('cccStaging.all') }}</option>
                  <option v-for="type in reviewTypes" :key="type" :value="type">
                    {{ t(`cccStaging.types.${type}`) }}
                  </option>
                </select></label
              >
              <AdminButton type="submit">{{
                t('cccStaging.applyFilters')
              }}</AdminButton>
            </fieldset>
          </form>
        </details>
      </template>
      <template #selection>
        <label
          v-if="requiresAcknowledgement && canEdit"
          class="flex items-center gap-2 text-xs text-admin-muted"
        >
          <input
            v-model="acknowledgeAll"
            type="checkbox"
            :disabled="blocked"
          />{{ t('cccStaging.confirmAll') }}
        </label>
      </template>
    </DraftQueue>
    <DialogRoot
      :open="flow.kind === 'discard'"
      @update:open="
        (open) => {
          if (!open) closeDialog()
        }
      "
    >
      <AdminDialogContent
        v-if="flow.kind === 'discard'"
        :close-label="t('cccStaging.close')"
      >
        <DialogTitle>{{
          t('cccStaging.discardTitle', { count: flow.uids.length })
        }}</DialogTitle>
        <DialogDescription>{{
          t('cccStaging.discardDescription')
        }}</DialogDescription>
        <ul class="grid gap-2 text-sm">
          <li v-for="uid in flow.uids" :key="uid">
            <code class="break-all">{{ uid }}</code>
          </li>
        </ul>
        <div class="flex justify-end gap-2">
          <AdminButton @click="closeDialog">{{
            t('cccStaging.cancel')
          }}</AdminButton
          ><AdminButton variant="danger" @click="discard">{{
            t('cccStaging.deleteChanges')
          }}</AdminButton>
        </div>
      </AdminDialogContent>
    </DialogRoot>
    <CatalogCheckedReceiptDialog
      v-if="flow.kind === 'final'"
      :receipt="flow.receipt"
      :changes="finalChanges"
      :selected-uids="flow.uids"
      :return-focus="flow.trigger"
      :csrf
      :locale
      @close="closeDialog"
    />
  </CatalogAdminShell>
</template>
