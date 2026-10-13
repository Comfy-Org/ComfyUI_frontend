<script setup lang="ts">
import { computed } from 'vue'
import { Check, Pause, CircleAlert, Trash2, ArrowUpRight } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import {
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem
} from 'reka-ui'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { Decision, ReviewItem } from '@/lib/cms/staging-review'
import { fieldDifferences, itemTitle } from '@/lib/cms/staging-review'
import CatalogChangeMedia from './CatalogChangeMedia.vue'

const {
  item,
  canApply = false,
  canEdit = false,
  selected = false,
  disabled = false,
  locale = 'en',
  draftRev
} = defineProps<{
  item: ReviewItem
  canApply?: boolean
  canEdit?: boolean
  selected?: boolean
  disabled?: boolean
  locale?: Locale
  draftRev?: number
}>()
const emit = defineEmits<{
  decision: [uid: string, status: Decision]
  selection: [uid: string, checked: boolean]
  discard: [uid: string]
}>()
const t = computed(() => translationsFor(locale).t)
const differences = computed(() => fieldDifferences(item))
const parentNames = computed(() =>
  item.presentation?.uses
    ?.slice(0, 2)
    .map((use) => use.title)
    .join(', ')
)
const recordHref = computed(() => {
  const path = `/admin/content/${item.content.uid}/view`
  return draftRev && Number.isSafeInteger(draftRev) && draftRev > 0
    ? `${path}?rev=${draftRev}&version=${item.content.revision_uid}`
    : path
})
const badgeClass = computed(() =>
  cn(
    'inline-flex h-8 w-full items-center justify-center gap-1 rounded-lg border px-1 text-[.625rem] font-medium focus-visible:outline-2 focus-visible:outline-admin-fg disabled:opacity-40 sm:gap-2 sm:px-2 sm:text-xs',
    item.decision === 'APPROVED'
      ? 'border-admin-success/40 bg-admin-success/12 text-admin-success'
      : item.decision === 'DEFERRED'
        ? 'border-admin-line bg-admin-page text-admin-muted opacity-60'
        : 'border-admin-field text-admin-fg'
  )
)
function changeDecision(status: Decision) {
  if (!disabled && canApply) emit('decision', item.content.uid, status)
}
function changeSelection(event: Event) {
  if (
    !disabled &&
    (canApply || canEdit) &&
    event.target instanceof HTMLInputElement
  )
    emit('selection', item.content.uid, event.target.checked)
}
</script>
<template>
  <li
    :data-review-state="item.decision"
    :class="
      cn(
        'grid grid-cols-[1rem_2.5rem_minmax(0,1fr)_6rem_1.5rem_1.5rem] items-center gap-2 border-b border-admin-line px-3 py-3 last:border-b-0 sm:grid-cols-[1.25rem_3rem_minmax(0,1fr)_8rem_1.5rem_1.5rem] sm:gap-3 sm:px-4',
        item.decision === 'APPROVED' && 'bg-admin-success/5',
        item.decision === 'DEFERRED' && 'bg-admin-page text-admin-muted'
      )
    "
  >
    <input
      v-if="canApply || canEdit"
      type="checkbox"
      :aria-label="t('cccStaging.selectItem', { title: itemTitle(item) })"
      :checked="selected"
      :disabled="disabled"
      :title="item.decision === 'NEW' ? t('cccStaging.newWarning') : undefined"
      :aria-description="
        item.decision === 'NEW' ? t('cccStaging.newWarning') : undefined
      "
      :class="
        cn(
          'size-4 accent-admin-success',
          item.decision === 'DEFERRED' && 'accent-admin-muted opacity-50'
        )
      "
      @change="changeSelection"
    />
    <span v-else aria-hidden="true" />
    <CatalogChangeMedia
      :key="item.presentation?.preview?.src ?? item.content.revision_uid"
      :preview="item.presentation?.preview"
      :label="t('cccChangeDetails.previewFor', { title: itemTitle(item) })"
      :unavailable="t('cccChangeDetails.unavailable')"
      :class="item.decision === 'DEFERRED' ? 'opacity-40 grayscale' : undefined"
    />
    <DialogRoot>
      <DialogTrigger
        :class="
          cn(
            'min-w-0 text-left focus-visible:outline-2 focus-visible:outline-admin-fg',
            item.decision === 'DEFERRED' && 'text-admin-muted opacity-60'
          )
        "
      >
        <span class="block truncate text-sm font-medium">{{
          itemTitle(item)
        }}</span>
        <span class="block truncate text-xs text-admin-muted"
          ><span
            v-if="item.status === 'DELETED'"
            :class="
              item.decision === 'DEFERRED'
                ? 'text-admin-muted'
                : 'text-admin-danger-text'
            "
            >{{ t('cccStaging.states.DELETED') }} · </span
          >{{ item.summary }}</span
        >
        <span
          v-if="parentNames"
          class="block truncate text-xs text-admin-muted"
          >{{ t('cccChangeDetails.parentNames', { names: parentNames }) }}</span
        >
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-60 bg-primary-comfy-ink/60" />
        <DialogContent
          class="fixed top-1/2 left-1/2 z-60 max-h-[85dvh] w-[calc(100%-2rem)] max-w-3xl -translate-1/2 overflow-y-auto rounded-xl border border-admin-line bg-admin-chrome p-5 font-admin text-admin-fg shadow-admin-popover"
        >
          <DialogTitle class="text-lg font-medium">{{
            itemTitle(item)
          }}</DialogTitle>
          <DialogDescription class="my-2 text-sm text-admin-muted">{{
            item.summary
          }}</DialogDescription>
          <code class="block text-xs break-all">{{ item.content.uid }}</code>
          <div v-if="item.presentation?.preview" class="mt-4">
            <CatalogChangeMedia
              :key="item.presentation.preview.src"
              :preview="item.presentation.preview"
              :label="
                t('cccChangeDetails.previewFor', { title: itemTitle(item) })
              "
              :unavailable="t('cccChangeDetails.unavailable')"
              expanded
            />
          </div>
          <p
            v-if="item.presentation?.media_name"
            class="mt-3 text-sm break-all text-admin-muted"
          >
            {{ item.presentation.media_name }}
          </p>
          <section v-if="item.content.type === 'media'" class="mt-4">
            <h3 class="text-sm font-medium">
              {{ t('cccChangeDetails.usedBy') }}
            </h3>
            <ul v-if="item.presentation?.uses?.length" class="mt-2 grid gap-2">
              <li
                v-for="use in item.presentation.uses"
                :key="use.uid"
                class="text-sm"
              >
                <a :href="`/admin/content/${use.uid}/view`" class="underline">{{
                  use.title
                }}</a>
                <span v-if="use.origin" class="ml-2 text-xs text-admin-muted">{{
                  t('cccChangeDetails.uploadSource')
                }}</span>
                <span
                  v-if="use.is_deleted"
                  class="ml-2 text-xs text-admin-muted"
                  >{{ t('cccChangeDetails.deleted') }}</span
                >
                <code class="block text-xs break-all text-admin-muted">{{
                  use.uid
                }}</code>
              </li>
            </ul>
            <p v-else class="mt-2 text-xs text-admin-muted">
              {{
                t(
                  item.presentation?.uses
                    ? 'cccChangeDetails.noUses'
                    : 'cccChangeDetails.contextUnavailable'
                )
              }}
            </p>
          </section>
          <a
            :href="recordHref"
            class="mt-4 inline-flex items-center gap-1 text-sm underline"
            >{{ t('cccChangeDetails.openRecord')
            }}<ArrowUpRight class="size-4" aria-hidden="true"
          /></a>
          <p class="mt-2 text-xs text-admin-muted">
            {{ t('cccStaging.originalAuthor') }}: {{ item.content.author_uid }}
          </p>
          <p class="mt-2 text-xs text-admin-muted">
            {{ t('cccStaging.diffLimit') }}
          </p>
          <ul class="my-4 grid gap-3">
            <li
              v-for="difference in differences"
              :key="difference.path"
              class="rounded-lg border border-admin-line p-3 text-xs"
            >
              <code class="font-medium break-all">{{ difference.path }}</code>
              <pre
                v-if="difference.before !== undefined"
                class="mt-2 break-all whitespace-pre-wrap text-admin-danger-text"
                >{{ difference.before }}</pre>
              <pre
                v-if="difference.after !== undefined"
                class="mt-2 break-all whitespace-pre-wrap text-admin-success"
                >{{ difference.after }}</pre>
            </li>
          </ul>
          <DialogClose
            class="rounded-lg border border-admin-field px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-admin-fg"
            >{{ t('cccStaging.close') }}</DialogClose
          >
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
    <DropdownMenuRoot v-if="canApply">
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          :aria-label="t('cccStaging.decisionFor', { title: itemTitle(item) })"
          :disabled="disabled"
          :class="badgeClass"
          :title="
            item.decision === 'NEW' ? t('cccStaging.newWarning') : undefined
          "
          :aria-description="
            item.decision === 'NEW' ? t('cccStaging.newWarning') : undefined
          "
        >
          <Check
            v-if="item.decision === 'APPROVED'"
            class="size-3.5"
            aria-hidden="true"
          />
          <Pause
            v-else-if="item.decision === 'DEFERRED'"
            class="size-3.5"
            aria-hidden="true"
          />
          <CircleAlert
            v-else
            class="size-3.5 text-admin-danger-text"
            aria-hidden="true"
          />
          {{ t(`cccStaging.states.${item.decision}`) }}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          align="center"
          :side-offset="6"
          class="z-60 min-w-40 rounded-lg border border-admin-field bg-admin-raised p-1 font-admin text-admin-fg shadow-admin-popover"
        >
          <DropdownMenuItem
            v-for="status in ['APPROVED', 'DEFERRED']"
            :key="status"
            class="cursor-pointer rounded-md px-3 py-2 text-xs outline-none data-highlighted:bg-admin-hover"
            @select="
              changeDecision(status === 'APPROVED' ? 'APPROVED' : 'DEFERRED')
            "
            >{{ t(`cccStaging.states.${status}`) }}</DropdownMenuItem
          >
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
    <span
      v-else
      :class="badgeClass"
      :title="item.decision === 'NEW' ? t('cccStaging.newWarning') : undefined"
      ><CircleAlert
        v-if="item.decision === 'NEW'"
        class="size-3.5 text-admin-danger-text"
        aria-hidden="true"
      />{{ t(`cccStaging.states.${item.decision}`) }}</span
    >
    <a
      :href="recordHref"
      :aria-label="t('cccChangeDetails.openFor', { title: itemTitle(item) })"
      :title="t('cccChangeDetails.openFor', { title: itemTitle(item) })"
      class="flex size-6 items-center justify-center rounded-sm text-admin-muted hover:bg-admin-hover hover:text-admin-fg focus-visible:outline-2 focus-visible:outline-admin-fg"
      ><ArrowUpRight class="size-4" aria-hidden="true"
    /></a>
    <button
      v-if="canEdit"
      type="button"
      :aria-label="t('cccStaging.deleteChangeFor', { title: itemTitle(item) })"
      :title="t('cccStaging.deleteChangeFor', { title: itemTitle(item) })"
      :disabled="disabled"
      class="flex size-6 items-center justify-center rounded-sm text-admin-muted hover:bg-admin-danger/12 hover:text-admin-danger-text focus-visible:outline-2 focus-visible:outline-admin-fg disabled:opacity-40"
      @click="emit('discard', item.content.uid)"
    >
      <Trash2 class="size-4" aria-hidden="true" />
    </button>
    <span v-else aria-hidden="true" />
  </li>
</template>
