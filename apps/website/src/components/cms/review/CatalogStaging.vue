<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/cms/ui/PageHeader.vue'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription
} from 'reka-ui'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type {
  Decision,
  ReviewFilter,
  StagingReview
} from '@/lib/cms/staging-review'
import {
  editorialStates,
  reviewTypes,
  reviewFilter,
  stagingSnapshot,
  stagePayload,
  discardPayload,
  itemTitle,
  unfiltered
} from '@/lib/cms/staging-review'
import { reviewRequest } from '@/lib/cms/staging-client'
import CatalogAdminShell from '@/components/cms/layout/CatalogAdminShell.vue'
import CatalogChangeRow from './CatalogChangeRow.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
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
const t = computed(() => translationsFor(locale).t)
type Flow =
  | { kind: 'ready'; review: StagingReview; message?: string }
  | { kind: 'loading' | 'saving' | 'exiting'; review: StagingReview }
  | {
      kind: 'confirmDiscard'
      review: StagingReview
      uids: string[]
      key: string
    }
  | {
      kind: 'failed'
      review: StagingReview
      reason: 'stale' | 'failed' | 'invalid' | 'dependency'
      details?: string
    }
const flow = ref<Flow>({ kind: 'ready', review: initial })
const selected = ref(new Set<string>())
const acknowledgeAll = ref(false)

const form = ref({
  search: initial.filter.search ?? '',
  author: initial.filter.author_uid ?? '',
  tags: initial.filter.tags?.join(', ') ?? '',
  type: initial.filter.types?.[0] ?? '',
  status:
    initial.filter.statuses?.length === 2 &&
    initial.filter.statuses.includes('NEW') &&
    initial.filter.statuses.includes('APPROVED')
      ? 'pending'
      : (initial.filter.statuses?.[0] ?? '')
})
const busy = computed(() =>
  ['loading', 'saving', 'exiting'].includes(flow.value.kind)
)
const blocked = computed(() => flow.value.kind !== 'ready')
const allSelected = computed(
  () =>
    flow.value.review.items.length > 0 &&
    flow.value.review.items.every((item) =>
      selected.value.has(item.content.uid)
    )
)
const needsAllAcknowledgement = computed(
  () => allSelected.value && unfiltered(flow.value.review.filter)
)
const bulkBlocked = computed(
  () =>
    blocked.value ||
    !selected.value.size ||
    (needsAllAcknowledgement.value && !acknowledgeAll.value)
)

const knownTags = computed(() =>
  [
    ...new Set(
      initial.items.flatMap((entry) =>
        Array.isArray(entry.content.document.tags)
          ? entry.content.document.tags.filter(
              (tag): tag is string => typeof tag === 'string'
            )
          : []
      )
    )
  ].sort()
)
const inputClass =
  'w-full min-w-0 rounded-lg border border-admin-field bg-admin-chrome px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-admin-fg'
function filterInput(): ReviewFilter | undefined {
  const parsed = reviewFilter.safeParse({
    ...(form.value.search.trim() ? { search: form.value.search.trim() } : {}),
    ...(form.value.author.trim()
      ? { author_uid: form.value.author.trim() }
      : {}),
    ...(form.value.tags.trim()
      ? { tags: form.value.tags.split(',').map((tag) => tag.trim()) }
      : {}),
    ...(form.value.type ? { types: [form.value.type] } : {}),
    ...(form.value.status
      ? {
          statuses:
            form.value.status === 'pending'
              ? ['NEW', 'APPROVED']
              : [form.value.status]
        }
      : {})
  })
  return parsed.success ? parsed.data : undefined
}
async function load() {
  if (busy.value || flow.value.kind === 'confirmDiscard') return
  const filter = filterInput()
  if (!filter) {
    flow.value = {
      kind: 'failed',
      review: flow.value.review,
      reason: 'invalid'
    }
    return
  }
  const previous = flow.value.review
  flow.value = { kind: 'loading', review: previous }
  const response = await reviewRequest('staging', { filter })
  const review = response.ok ? stagingSnapshot(response.data) : undefined
  flow.value = review
    ? { kind: 'ready', review }
    : { kind: 'failed', review: previous, reason: 'failed' }
  if (review) {
    selected.value = new Set()
    acknowledgeAll.value = false
  }
}
async function requestBulk(status: 'APPROVED' | 'DEFERRED') {
  if (bulkBlocked.value || !canApply) return
  const selectedUIDs = flow.value.review.items
    .filter((item) => selected.value.has(item.content.uid))
    .map((item) => item.content.uid)
  if (!selectedUIDs.length) return
  await applyDecision({
    review: flow.value.review,
    selection: flow.value.review,
    status,
    confirmAll: needsAllAcknowledgement.value && acknowledgeAll.value,
    key: crypto.randomUUID(),
    selectedUIDs
  })
}
function selectItem(uid: string, checked: boolean) {
  if (
    blocked.value ||
    (!canApply && !canEdit) ||
    !flow.value.review.items.some((item) => item.content.uid === uid)
  )
    return
  const next = new Set(selected.value)
  if (checked) next.add(uid)
  else next.delete(uid)
  selected.value = next
  acknowledgeAll.value = false
}
function selectAll(event: Event) {
  if (
    blocked.value ||
    (!canApply && !canEdit) ||
    !(event.target instanceof HTMLInputElement)
  )
    return
  selected.value = event.target.checked
    ? new Set(flow.value.review.items.map((item) => item.content.uid))
    : new Set()
  acknowledgeAll.value = false
}
async function requestSingle(uid: string, status: Decision) {
  if (blocked.value || !canApply) return
  const previous = flow.value.review
  flow.value = { kind: 'loading', review: previous }
  const response = await reviewRequest('staging', { filter: { search: uid } })
  const selection = response.ok ? stagingSnapshot(response.data) : undefined
  if (
    !selection ||
    selection.items.length !== 1 ||
    selection.items[0]?.content.uid !== uid ||
    selection.state.draft_generation !== previous.state.draft_generation ||
    selection.state.live_rev !== previous.state.live_rev ||
    selection.state.draft_rev !== previous.state.draft_rev
  ) {
    flow.value = { kind: 'failed', review: previous, reason: 'stale' }
    return
  }
  await applyDecision({
    review: previous,
    selection,
    status,
    confirmAll: false,
    key: crypto.randomUUID()
  })
}
async function applyDecision(pending: {
  review: StagingReview
  selection: StagingReview
  status: Decision
  confirmAll: boolean
  key: string
  selectedUIDs?: string[]
}) {
  if (!canApply) return
  flow.value = { kind: 'saving', review: pending.review }
  const response = await reviewRequest('staging', {
    csrf,
    key: pending.key,
    body: JSON.stringify(
      stagePayload(
        pending.selection,
        pending.status,
        pending.confirmAll,
        pending.selectedUIDs
      )
    )
  })
  const changed = response.ok ? stagingSnapshot(response.data) : undefined
  if (!changed) {
    flow.value = {
      kind: 'failed',
      review: pending.review,
      reason: response.status === 409 ? 'stale' : 'failed'
    }
    return
  }
  // A single-row action has a different matching filter. Fetch the original
  // scope again; never mistake its one-row response for the entire queue.
  const current = await reviewRequest('staging', {
    filter: pending.review.filter
  })
  const review = current.ok ? stagingSnapshot(current.data) : undefined
  flow.value = review
    ? { kind: 'ready', review, message: t.value('cccStaging.saved') }
    : { kind: 'failed', review: pending.review, reason: 'failed' }
  if (review) {
    selected.value = new Set()
    acknowledgeAll.value = false
  }
}
async function exit() {
  if (busy.value || flow.value.kind === 'confirmDiscard') return
  const previous = flow.value.review
  flow.value = { kind: 'exiting', review: previous }
  const response = await reviewRequest('exit', { csrf })
  if (response.ok) window.location.assign('/hub/models/')
  else flow.value = { kind: 'failed', review: previous, reason: 'failed' }
}
function requestDiscard(uids: string[]) {
  if (!canEdit || blocked.value || !uids.length || uids.length > 100) return
  const matching = new Set(
    flow.value.review.items.map((item) => item.content.uid)
  )
  if (
    new Set(uids).size !== uids.length ||
    uids.some((uid) => !matching.has(uid))
  )
    return
  flow.value = {
    kind: 'confirmDiscard',
    review: flow.value.review,
    uids: [...uids],
    key: crypto.randomUUID()
  }
}
function requestBulkDiscard() {
  if (bulkBlocked.value) return
  requestDiscard([...selected.value])
}
function cancelDiscard() {
  if (flow.value.kind === 'confirmDiscard')
    flow.value = { kind: 'ready', review: flow.value.review }
}
async function confirmDiscard() {
  if (!canEdit || flow.value.kind !== 'confirmDiscard') return
  const pending = flow.value
  flow.value = { kind: 'saving', review: pending.review }
  const response = await reviewRequest('discard-changes', {
    csrf,
    key: pending.key,
    body: JSON.stringify(discardPayload(pending.review, pending.uids))
  })
  if (!response.ok || !stagingSnapshot(response.data)) {
    flow.value = {
      kind: 'failed',
      review: pending.review,
      reason:
        response.status === 409
          ? 'stale'
          : response.status === 422
            ? 'dependency'
            : 'failed',
      details:
        response.status === 422 ? discardDetails(response.data) : undefined
    }
    return
  }
  const current = await reviewRequest('staging', {
    filter: pending.review.filter
  })
  const review = current.ok ? stagingSnapshot(current.data) : undefined
  flow.value = review
    ? { kind: 'ready', review, message: t.value('cccStaging.discarded') }
    : { kind: 'failed', review: pending.review, reason: 'failed' }
  if (review) {
    selected.value = new Set()
    acknowledgeAll.value = false
  }
}
function discardDetails(raw: unknown) {
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('field_errors' in raw) ||
    !Array.isArray(raw.field_errors)
  )
    return undefined
  return raw.field_errors
    .slice(0, 100)
    .flatMap((entry: unknown) =>
      entry &&
      typeof entry === 'object' &&
      'path' in entry &&
      'message' in entry &&
      typeof entry.path === 'string' &&
      typeof entry.message === 'string'
        ? [`${entry.path.slice(0, 2000)}: ${entry.message.slice(0, 1000)}`]
        : []
    )
    .join('\n')
}
</script>
<template>
  <CatalogAdminShell
    current="draft"
    :navigation="[{ key: 'draft', href: '/admin/catalog' }]"
    :draft-count="flow.review.items.length"
    :live-revision="flow.review.state.live_rev"
    :busy="busy"
    :locale="locale"
    @open-live="exit"
  >
    <PageHeader :title="t('cccStaging.title')">
      <template #eyebrow>
        <p class="text-xs text-admin-muted">
          {{
            t('cccStaging.revision', { revision: flow.review.state.draft_rev })
          }}
        </p>
      </template>
      <p
        class="mt-4 inline-block rounded-md border border-admin-field px-2 py-1 text-xs font-semibold tracking-wide"
      >
        {{ t('cccStaging.phase1') }}
      </p>
      <p class="mt-2 text-base font-medium">
        {{ t('cccStaging.phaseInstruction') }}
      </p>
      <p class="mt-1 max-w-3xl text-sm text-admin-muted">
        {{ t('cccStaging.phaseHelp') }}
      </p>
      <template #actions>
        <div v-if="canApply" class="flex flex-col items-end gap-2">
          <AdminButton
            variant="primary"
            href="/admin/catalog/final-review"
            :disabled="blocked || flow.review.unresolved_count > 0"
            >{{ t('cccStaging.next') }}</AdminButton
          >
          <span class="text-xs text-admin-muted">{{
            t('cccStaging.finalReview')
          }}</span>
          <p
            v-if="flow.review.unresolved_count > 0"
            role="status"
            class="max-w-64 text-right text-xs text-admin-danger-text"
          >
            {{
              t('cccStaging.unresolved', {
                count: flow.review.unresolved_count
              })
            }}
          </p>
        </div>
      </template>
    </PageHeader>
    <form
      class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
      @submit.prevent="load"
    >
      <fieldset
        :disabled="busy || flow.kind === 'confirmDiscard'"
        class="contents"
      >
        <label class="text-xs text-admin-muted xl:col-span-2"
          >{{ t('cccStaging.search')
          }}<input v-model="form.search" maxlength="300" :class="inputClass"
        /></label>
        <label class="text-xs text-admin-muted"
          >{{ t('cccStaging.originalAuthor')
          }}<input v-model="form.author" :class="inputClass"
        /></label>
        <label class="text-xs text-admin-muted"
          >{{ t('cccStaging.tags')
          }}<input
            v-model="form.tags"
            list="ccc-known-tags"
            :class="inputClass" /><datalist id="ccc-known-tags">
            <option
              v-for="tag in knownTags"
              :key="tag"
              :value="tag"
            /></datalist
        ></label>
        <label class="text-xs text-admin-muted"
          >{{ t('cccStaging.type')
          }}<select v-model="form.type" :class="inputClass">
            <option value="">{{ t('cccStaging.all') }}</option>
            <option v-for="type in reviewTypes" :key="type" :value="type">
              {{ t(`cccStaging.types.${type}`) }}
            </option>
          </select></label
        >
        <label class="text-xs text-admin-muted"
          >{{ t('cccStaging.status')
          }}<select v-model="form.status" :class="inputClass">
            <option value="">{{ t('cccStaging.all') }}</option>
            <option value="pending">{{ t('cccStaging.pending') }}</option>
            <option
              v-for="status in editorialStates"
              :key="status"
              :value="status"
            >
              {{ t(`cccStaging.states.${status}`) }}
            </option>
          </select></label
        >
        <AdminButton type="submit">{{
          t('cccStaging.applyFilters')
        }}</AdminButton>
      </fieldset>
    </form>
    <p
      v-if="flow.kind === 'failed'"
      role="alert"
      class="mt-4 text-sm text-admin-danger-text"
    >
      {{ t(`cccStaging.errors.${flow.reason}`) }}
      <span v-if="flow.details" class="mt-2 block whitespace-pre-wrap">{{
        flow.details
      }}</span>
    </p>
    <p
      v-if="flow.kind === 'ready' && flow.message"
      role="status"
      class="mt-4 text-sm text-admin-success"
    >
      {{ flow.message }}
    </p>
    <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
      <p role="status" class="text-sm text-admin-muted">
        {{
          busy
            ? t('cccStaging.working')
            : t('cccStaging.matches', { count: flow.review.items.length })
        }}
      </p>
      <div v-if="canApply || canEdit" class="flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-xs text-admin-muted"
          ><input
            type="checkbox"
            :checked="allSelected"
            :indeterminate="selected.size > 0 && !allSelected"
            :disabled="blocked || !flow.review.items.length"
            :aria-label="t('cccStaging.selectAll')"
            class="size-4 accent-admin-success"
            @change="selectAll"
          />{{ t('cccStaging.all') }}</label
        >
        <AdminButton
          v-if="canApply"
          variant="primary"
          size="lg"
          :disabled="bulkBlocked"
          @click="requestBulk('APPROVED')"
          >{{ t('cccStaging.approveSelected') }}</AdminButton
        >
        <AdminButton
          v-if="canApply"
          size="lg"
          :disabled="bulkBlocked"
          @click="requestBulk('DEFERRED')"
          >{{ t('cccStaging.deferSelected') }}</AdminButton
        >
        <AdminButton
          v-if="canEdit"
          variant="dangerGhost"
          size="lg"
          :disabled="bulkBlocked || selected.size > 100"
          @click="requestBulkDiscard"
          >{{ t('cccStaging.deleteChanges') }}</AdminButton
        >
        <AdminButton
          v-if="canEdit"
          href="/admin/content/new"
          size="lg"
          :disabled="blocked"
          >{{ t('cccStaging.addContent') }}</AdminButton
        >
        <span
          v-if="canEdit && selected.size > 100"
          class="text-xs text-admin-danger-text"
          >{{ t('cccStaging.discardLimit') }}</span
        >
        <span class="text-xs text-admin-muted">{{
          t('cccStaging.selectedCount', { count: selected.size })
        }}</span>
      </div>
    </div>
    <label
      v-if="(canApply || canEdit) && needsAllAcknowledgement"
      class="mt-3 flex items-center gap-2 text-xs text-admin-muted"
    >
      <input
        v-model="acknowledgeAll"
        type="checkbox"
        :disabled="blocked"
        class="size-4 accent-admin-success"
      />
      {{ t('cccStaging.confirmAll') }}
    </label>
    <ul
      :aria-label="t('cccStaging.changes')"
      class="mt-3 rounded-xl border border-admin-line bg-admin-chrome"
    >
      <CatalogChangeRow
        v-for="item in flow.review.items"
        :key="item.content.uid"
        :item="item"
        :can-apply="canApply"
        :can-edit="canEdit"
        :selected="selected.has(item.content.uid)"
        :disabled="blocked"
        :locale="locale"
        :draft-rev="flow.review.state.draft_rev"
        @decision="requestSingle"
        @selection="selectItem"
        @discard="(uid) => requestDiscard([uid])"
      />
    </ul>
    <p v-if="!flow.review.items.length" class="mt-4 text-sm text-admin-muted">
      {{ t('cccStaging.empty') }}
    </p>
    <DialogRoot
      :open="flow.kind === 'confirmDiscard'"
      @update:open="
        (open) => {
          if (!open) cancelDiscard()
        }
      "
    >
      <DialogPortal
        ><DialogOverlay class="fixed inset-0 z-60 bg-primary-comfy-ink/60" />
        <DialogContent
          v-if="flow.kind === 'confirmDiscard'"
          class="fixed top-1/2 left-1/2 z-60 max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg -translate-1/2 overflow-y-auto rounded-xl border border-admin-field bg-admin-raised p-5 font-admin text-admin-fg shadow-admin-popover"
        >
          <DialogTitle class="text-lg font-medium">{{
            t('cccStaging.discardTitle', { count: flow.uids.length })
          }}</DialogTitle>
          <DialogDescription class="mt-3 text-sm text-admin-muted">{{
            t('cccStaging.discardDescription')
          }}</DialogDescription>
          <ul class="my-4 grid gap-2 text-sm">
            <li
              v-for="item in flow.review.items.filter(
                (entry) =>
                  flow.kind === 'confirmDiscard' &&
                  flow.uids.includes(entry.content.uid)
              )"
              :key="item.content.uid"
            >
              {{ itemTitle(item)
              }}<code class="block text-xs break-all text-admin-muted">{{
                item.content.uid
              }}</code>
            </li>
          </ul>
          <div class="flex justify-end gap-2">
            <AdminButton @click="cancelDiscard">{{
              t('cccStaging.cancelDiscard')
            }}</AdminButton>
            <AdminButton variant="danger" @click="confirmDiscard">{{
              t('cccStaging.deleteChanges')
            }}</AdminButton>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </CatalogAdminShell>
</template>
