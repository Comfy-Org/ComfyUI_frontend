<script setup lang="ts">
import { computed, ref } from 'vue'
import { DialogRoot, DialogTitle, DialogDescription } from 'reka-ui'
import CatalogAdminShell from '@/components/cms/layout/CatalogAdminShell.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import AdminTabs from '@/components/cms/ui/AdminTabs.vue'
import AdminDialogContent from '@/components/cms/ui/AdminDialogContent.vue'
import PageHeader from '@/components/cms/ui/PageHeader.vue'
import CatalogChangeRow from './CatalogChangeRow.vue'
import CatalogFinalReviewDialog from './CatalogFinalReviewDialog.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { FinalReview, StagingReview } from '@/lib/cms/staging-review'
import {
  checkedReviewPayload,
  discardPayload,
  finalSnapshot,
  reviewFilter,
  reviewTypes,
  stagingSnapshot,
  unfiltered
} from '@/lib/cms/staging-review'
import { matchesCheckedReview } from '@/lib/cms/checked-review'
import { reviewRequest } from '@/lib/cms/staging-client'

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
      reason: 'stale' | 'failed' | 'dependency'
    }
  | { kind: 'discard'; snapshot: StagingReview; uids: string[]; key: string }
  | {
      kind: 'final'
      snapshot: StagingReview
      final: FinalReview
      uids: string[]
      trigger?: HTMLElement
    }
const flow = ref<Flow>({ kind: 'ready', snapshot: initial })
const selected = ref(new Set<string>())
const acknowledgeAll = ref(false)
const form = ref({
  search: initial.filter.search ?? '',
  author: initial.filter.author_uid ?? '',
  tags: initial.filter.tags?.join(', ') ?? '',
  type: initial.filter.types?.[0] ?? ''
})
const tab = ref<'ALL' | 'NEW' | 'UPDATES'>('ALL')
const tabs = computed(() =>
  (['ALL', 'NEW', 'UPDATES'] as const).map((value) => ({
    value,
    label: t(`cccChecked.tabs.${value}`)
  }))
)
const visible = computed(() =>
  flow.value.snapshot.items.filter(
    (item) => tab.value === 'ALL' || (tab.value === 'NEW') === !item.before
  )
)
const blocked = computed(() => flow.value.kind !== 'ready')
const busy = computed(
  () => flow.value.kind === 'loading' || flow.value.kind === 'saving'
)
const allSelected = computed(
  () =>
    visible.value.length > 0 &&
    visible.value.every((item) => selected.value.has(item.content.uid))
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

function select(uid: string, checked: boolean) {
  if (blocked.value || (!canApply && !canEdit)) return
  if (!flow.value.snapshot.items.some((item) => item.content.uid === uid))
    return
  const next = new Set(selected.value)
  if (checked) next.add(uid)
  else next.delete(uid)
  selected.value = next
  acknowledgeAll.value = false
}
function selectShown(event: Event) {
  if (
    blocked.value ||
    (!canApply && !canEdit) ||
    !(event.target instanceof HTMLInputElement)
  )
    return
  const next = new Set(selected.value)
  for (const item of visible.value) {
    if (event.target.checked) next.add(item.content.uid)
    else next.delete(item.content.uid)
  }
  selected.value = next
  acknowledgeAll.value = false
}
async function reload() {
  if (
    busy.value ||
    flow.value.kind === 'final' ||
    flow.value.kind === 'discard'
  )
    return
  const filter = reviewFilter.safeParse({
    ...(form.value.search.trim() ? { search: form.value.search.trim() } : {}),
    ...(form.value.author.trim()
      ? { author_uid: form.value.author.trim() }
      : {}),
    ...(form.value.tags.trim()
      ? { tags: form.value.tags.split(',').map((tag) => tag.trim()) }
      : {}),
    ...(form.value.type ? { types: [form.value.type] } : {})
  })
  if (!filter.success) return
  const previous = flow.value.snapshot
  flow.value = { kind: 'loading', snapshot: previous }
  const result = await reviewRequest('staging', { filter: filter.data })
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
  const result = await reviewRequest('final-review', {
    csrf,
    body: JSON.stringify(checkedReviewPayload(snapshot, uids))
  })
  const final = result.ok ? finalSnapshot(result.data) : undefined
  flow.value =
    final && matchesCheckedReview(snapshot, final, uids)
      ? { kind: 'final', snapshot, final, uids, trigger }
      : {
          kind: 'failed',
          snapshot,
          reason:
            result.status === 409 || (result.ok && Boolean(final))
              ? 'stale'
              : result.status === 422
                ? 'dependency'
                : 'failed'
        }
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
      reason:
        result.status === 409
          ? 'stale'
          : result.status === 422
            ? 'dependency'
            : 'failed'
    }
    return
  }
  const current = await reviewRequest('staging', {
    filter: pending.snapshot.filter
  })
  const snapshot = current.ok ? stagingSnapshot(current.data) : undefined
  flow.value = snapshot
    ? { kind: 'ready', snapshot }
    : { kind: 'failed', snapshot: pending.snapshot, reason: 'failed' }
  if (snapshot) {
    selected.value = new Set()
    acknowledgeAll.value = false
  }
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
    <PageHeader
      :title="t('cccStaging.title')"
      :description="t('cccChecked.instructions')"
    >
    </PageHeader>
    <form
      class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      @submit.prevent="reload"
    >
      <fieldset
        :disabled="busy || flow.kind === 'final' || flow.kind === 'discard'"
        class="contents"
      >
        <label class="text-xs text-admin-muted"
          >{{ t('cccStaging.search')
          }}<input v-model="form.search" maxlength="300" :class="inputClass"
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
    <p
      v-if="flow.kind === 'failed'"
      role="alert"
      class="mt-4 text-sm text-admin-danger-text"
    >
      {{ t(`cccStaging.errors.${flow.reason}`) }}
    </p>
    <div
      class="sticky top-0 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-admin-line bg-admin-chrome p-3"
    >
      <label class="flex items-center gap-2 text-xs"
        ><input
          type="checkbox"
          :checked="allSelected"
          :indeterminate="selected.size > 0 && !allSelected"
          :disabled="blocked || !visible.length || (!canApply && !canEdit)"
          :aria-label="t('cccChecked.selectShown')"
          @change="selectShown"
        />{{ t('cccStaging.all') }}</label
      >
      <div class="flex flex-wrap items-center gap-2">
        <span role="status" class="text-xs text-admin-muted">{{
          t('cccStaging.selectedCount', { count: selected.size })
        }}</span>
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
        <AdminButton
          v-if="canApply"
          variant="primary"
          :disabled="blocked || !selected.size"
          @click="review"
          >{{
            t('cccChecked.reviewSelected', { count: selected.size })
          }}</AdminButton
        >
      </div>
    </div>
    <label
      v-if="requiresAcknowledgement && canEdit"
      class="mt-3 flex items-center gap-2 text-xs text-admin-muted"
      ><input v-model="acknowledgeAll" type="checkbox" :disabled="blocked" />{{
        t('cccStaging.confirmAll')
      }}</label
    >
    <div class="mt-5 border-b border-admin-line">
      <AdminTabs
        v-model="tab"
        :options="tabs"
        :label="t('cccChecked.tabsLabel')"
      />
    </div>
    <ul
      :aria-label="t('cccStaging.changes')"
      class="mt-3 rounded-xl border border-admin-line bg-admin-chrome"
    >
      <CatalogChangeRow
        v-for="item in visible"
        :key="item.content.uid"
        :item
        :can-apply="canApply"
        :can-edit="canEdit"
        checkbox-only
        :selected="selected.has(item.content.uid)"
        :disabled="blocked"
        :locale
        :draft-rev="flow.snapshot.state.draft_rev"
        @selection="select"
        @discard="(uid) => requestDiscard([uid])"
      />
    </ul>
    <p v-if="!visible.length" class="mt-4 text-sm text-admin-muted">
      {{ t('cccStaging.empty') }}
    </p>
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
    <CatalogFinalReviewDialog
      v-if="flow.kind === 'final'"
      :review="flow.final"
      :selected-uids="flow.uids"
      :return-focus="flow.trigger"
      :csrf
      :locale
      @close="closeDialog"
    />
  </CatalogAdminShell>
</template>
