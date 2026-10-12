<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose
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
      kind: 'confirm'
      review: StagingReview
      selection: StagingReview
      status: Decision
      confirmAll: boolean
      key: string
    }
  | {
      kind: 'failed'
      review: StagingReview
      reason: 'stale' | 'failed' | 'invalid'
    }
const flow = ref<Flow>({ kind: 'ready', review: initial })
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
const confirmation = computed(() =>
  flow.value.kind === 'confirm' ? flow.value : undefined
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
  if (busy.value || confirmation.value) return
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
}
function requestBulk(status: Decision) {
  if (blocked.value || !canApply || !flow.value.review.items.length) return
  flow.value = {
    kind: 'confirm',
    review: flow.value.review,
    selection: flow.value.review,
    status,
    confirmAll: false,
    key: crypto.randomUUID()
  }
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
  flow.value = {
    kind: 'confirm',
    review: previous,
    selection,
    status,
    confirmAll: false,
    key: crypto.randomUUID()
  }
}
function closeConfirmation(open: boolean) {
  if (!open && flow.value.kind === 'confirm')
    flow.value = { kind: 'ready', review: flow.value.review }
}
function acknowledge(event: Event) {
  if (event.target instanceof HTMLInputElement && flow.value.kind === 'confirm')
    flow.value = { ...flow.value, confirmAll: event.target.checked }
}
async function confirm() {
  if (flow.value.kind !== 'confirm' || !canApply) return
  const pending = flow.value
  if (unfiltered(pending.selection.filter) && !pending.confirmAll) return
  flow.value = { kind: 'saving', review: pending.review }
  const response = await reviewRequest('staging', {
    csrf,
    key: pending.key,
    body: JSON.stringify(
      stagePayload(pending.selection, pending.status, pending.confirmAll)
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
    ? { kind: 'ready', review, message: t('cccStaging.saved') }
    : { kind: 'failed', review: pending.review, reason: 'failed' }
}
async function exit() {
  if (busy.value || confirmation.value) return
  const previous = flow.value.review
  flow.value = { kind: 'exiting', review: previous }
  const response = await reviewRequest('exit', { csrf })
  if (response.ok) window.location.assign('/hub/models/')
  else flow.value = { kind: 'failed', review: previous, reason: 'failed' }
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
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs text-admin-muted">
          {{
            t('cccStaging.revision', { revision: flow.review.state.draft_rev })
          }}
        </p>
        <h1 class="mt-1 text-2xl font-medium">{{ t('cccStaging.title') }}</h1>
        <p class="mt-2 text-sm text-admin-muted">
          {{ t('cccStaging.description') }}
        </p>
      </div>
      <AdminButton
        v-if="canApply"
        href="/admin/catalog/final-review"
        :disabled="blocked"
        >{{ t('cccStaging.finalReview') }}</AdminButton
      >
    </header>
    <form
      class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
      @submit.prevent="load"
    >
      <fieldset :disabled="busy || Boolean(confirmation)" class="contents">
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
      <div v-if="canApply" class="flex gap-2">
        <AdminButton
          :disabled="blocked || !flow.review.items.length"
          @click="requestBulk('APPROVED')"
          >{{ t('cccStaging.approveMatching') }}</AdminButton
        ><AdminButton
          :disabled="blocked || !flow.review.items.length"
          @click="requestBulk('DEFERRED')"
          >{{ t('cccStaging.deferMatching') }}</AdminButton
        >
      </div>
    </div>
    <ul
      :aria-label="t('cccStaging.changes')"
      class="mt-3 max-h-[65dvh] overflow-y-auto rounded-xl border border-admin-line bg-admin-chrome"
    >
      <CatalogChangeRow
        v-for="item in flow.review.items"
        :key="item.content.uid"
        :item="item"
        :can-apply="canApply"
        :can-edit="canEdit"
        :disabled="blocked"
        :locale="locale"
        @decision="requestSingle"
      />
    </ul>
    <p v-if="!flow.review.items.length" class="mt-4 text-sm text-admin-muted">
      {{ t('cccStaging.empty') }}
    </p>
    <DialogRoot :open="Boolean(confirmation)" @update:open="closeConfirmation">
      <DialogPortal
        ><DialogOverlay
          class="fixed inset-0 z-60 bg-primary-comfy-ink/60"
        /><DialogContent
          v-if="confirmation"
          class="fixed top-1/2 left-1/2 z-60 w-[calc(100%-2rem)] max-w-lg -translate-1/2 rounded-xl border border-admin-line bg-admin-chrome p-6 font-admin text-admin-fg shadow-admin-popover"
        >
          <DialogTitle class="text-lg font-medium">{{
            t('cccStaging.confirmTitle', {
              action: t(`cccStaging.states.${confirmation.status}`),
              count: confirmation.selection.items.length
            })
          }}</DialogTitle>
          <DialogDescription class="mt-2 text-sm text-admin-muted">{{
            t('cccStaging.confirmDescription')
          }}</DialogDescription>
          <pre
            class="mt-3 max-h-48 overflow-auto rounded-lg border border-admin-line p-3 text-xs whitespace-pre-wrap break-all"
            >{{ JSON.stringify(confirmation.selection.filter, null, 2) }}</pre>
          <label
            v-if="unfiltered(confirmation.selection.filter)"
            class="mt-4 flex gap-2 text-sm"
            ><input
              type="checkbox"
              :checked="confirmation.confirmAll"
              @change="acknowledge"
            />{{ t('cccStaging.confirmAll') }}</label
          >
          <div class="mt-5 flex justify-end gap-2">
            <DialogClose as-child
              ><AdminButton>{{
                t('cccStaging.cancel')
              }}</AdminButton></DialogClose
            ><AdminButton
              variant="primary"
              :disabled="
                unfiltered(confirmation.selection.filter) &&
                !confirmation.confirmAll
              "
              @click="confirm"
              >{{ t('cccStaging.confirm') }}</AdminButton
            >
          </div>
        </DialogContent></DialogPortal
      >
    </DialogRoot>
  </CatalogAdminShell>
</template>
