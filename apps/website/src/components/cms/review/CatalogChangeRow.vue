<script setup lang="ts">
import { computed } from 'vue'
import { Check, Pause, CircleAlert, Trash2 } from '@lucide/vue'
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

const {
  item,
  canApply = false,
  canEdit = false,
  selected = false,
  disabled = false,
  locale = 'en'
} = defineProps<{
  item: ReviewItem
  canApply?: boolean
  canEdit?: boolean
  selected?: boolean
  disabled?: boolean
  locale?: Locale
}>()
const emit = defineEmits<{
  decision: [uid: string, status: Decision]
  selection: [uid: string, checked: boolean]
  discard: [uid: string]
}>()
const t = computed(() => translationsFor(locale).t)
const differences = computed(() => fieldDifferences(item))
const badgeClass = computed(() =>
  cn(
    'inline-flex h-8 w-32 items-center justify-center gap-2 rounded-lg border px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-admin-fg disabled:opacity-40',
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
        'grid grid-cols-[1.25rem_minmax(0,1fr)_8rem_1.5rem] items-center gap-3 border-b border-admin-line px-4 py-3 last:border-b-0',
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
