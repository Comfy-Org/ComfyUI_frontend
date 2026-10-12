<script setup lang="ts">
import { computed } from 'vue'
import {
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose
} from 'reka-ui'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { Decision, ReviewItem } from '@/lib/cms/staging-review'
import { fieldDifferences, itemTitle } from '@/lib/cms/staging-review'
import { contentTypes } from '@/lib/cms/editor-document'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
const {
  item,
  canApply = false,
  canEdit = false,
  disabled = false,
  locale = 'en'
} = defineProps<{
  item: ReviewItem
  canApply?: boolean
  canEdit?: boolean
  disabled?: boolean
  locale?: Locale
}>()
const emit = defineEmits<{ decision: [uid: string, status: Decision] }>()
const t = computed(() => translationsFor(locale).t)
const differences = computed(() => fieldDifferences(item))
const editable = computed(
  () =>
    canEdit &&
    !item.content.is_deleted &&
    contentTypes.some((type) => type === item.content.type)
)
function changeDecision(event: Event) {
  if (disabled || !canApply || !(event.target instanceof HTMLSelectElement))
    return
  const status = event.target.value
  if (status === 'NEW' || status === 'APPROVED' || status === 'DEFERRED')
    emit('decision', item.content.uid, status)
}
</script>
<template>
  <li
    class="flex flex-wrap items-center gap-3 border-b border-admin-line px-4 py-3 last:border-b-0"
  >
    <DialogRoot>
      <DialogTrigger
        class="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-admin-fg"
      >
        <span class="block truncate text-sm font-medium">{{
          itemTitle(item)
        }}</span>
        <span class="block truncate text-xs text-admin-muted">{{
          item.summary
        }}</span>
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
                class="mt-2 whitespace-pre-wrap break-all text-admin-danger-text"
                >{{ difference.before }}</pre>
              <pre
                v-if="difference.after !== undefined"
                class="mt-2 whitespace-pre-wrap break-all text-admin-success"
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
    <div class="flex items-center gap-2 text-xs">
      <span
        v-if="item.status === 'DELETED'"
        class="rounded border border-admin-line px-2 py-1 text-admin-danger-text"
        >{{ t('cccStaging.states.DELETED') }}</span
      >
      <label v-if="canApply" class="flex items-center gap-2">
        <span class="sr-only">{{
          t('cccStaging.decisionFor', { title: itemTitle(item) })
        }}</span>
        <select
          :value="item.decision"
          :disabled="disabled"
          class="rounded-lg border border-admin-field bg-admin-chrome px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-admin-fg disabled:opacity-40"
          @change="changeDecision"
        >
          <option value="NEW">{{ t('cccStaging.states.NEW') }}</option>
          <option value="APPROVED">
            {{ t('cccStaging.states.APPROVED') }}
          </option>
          <option value="DEFERRED">
            {{ t('cccStaging.states.DEFERRED') }}
          </option>
        </select>
      </label>
      <span v-else class="rounded border border-admin-line px-2 py-1">{{
        t(`cccStaging.states.${item.decision}`)
      }}</span>
      <AdminButton
        v-if="editable"
        :href="`/admin/content/${item.content.uid}/edit`"
        size="sm"
        :disabled="disabled"
        >{{ t('cccStaging.edit') }}</AdminButton
      >
    </div>
  </li>
</template>
