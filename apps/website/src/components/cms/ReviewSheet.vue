<script setup lang="ts">
import { Check, ChevronDown, ChevronUp, Plus, Trash2 } from '@lucide/vue'
import { DialogDescription, DialogTitle } from 'reka-ui'
import { computed, nextTick } from 'vue'

import CatalogReview from '@/components/cms/CatalogReview.vue'
import ChangeTag from '@/components/cms/ChangeTag.vue'
import DeleteSubmissionButton from '@/components/cms/DeleteSubmissionButton.vue'
import SubmissionReview from '@/components/cms/SubmissionReview.vue'
import UndoChangeButton from '@/components/cms/UndoChangeButton.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import AdminSheetContent from '@/components/cms/ui/AdminSheetContent.vue'
import Sheet from '@/components/ui/sheet/Sheet.vue'
import CanonicalReviewDetails from '@/components/cms/review/CanonicalReviewDetails.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { formatUtc } from '@/lib/cms/format'
import type { QueueItem } from '@/lib/cms/queue'

const {
  item,
  index,
  total,
  canApply,
  canEdit,
  selected = false,
  csrf,
  disabled = false,
  draftRev,
  returnFocus,
  locale = 'en'
} = defineProps<{
  item: QueueItem
  index: number
  total: number
  canApply: boolean
  canEdit: boolean
  /** Whether the change is picked for the next publish. */
  selected?: boolean
  csrf: string
  disabled?: boolean
  draftRev?: number
  returnFocus?: HTMLElement
  locale?: Locale
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{
  step: [direction: -1 | 1]
  select: []
  discard: []
}>()
const { t } = translationsFor(locale)
async function restoreFocus(event: Event) {
  event.preventDefault()
  await nextTick()
  if (returnFocus?.isConnected) returnFocus.focus()
}

const subtitle = computed(() =>
  item.source === 'submission'
    ? `${item.author} · ${t('cmsAdmin.review.submitted', {
        date: formatUtc(item.submittedAt, locale)
      })}`
    : `${item.provider ?? t('cmsAdmin.draft.catalogSource')} · ${item.slug}`
)
</script>

<template>
  <Sheet
    :open="open"
    @update:open="
      (value) => {
        if (!disabled) open = value
      }
    "
  >
    <AdminSheetContent
      :close-label="t('cmsAdmin.review.close')"
      :close-disabled="disabled"
      @close-auto-focus="restoreFocus"
    >
      <header
        class="flex h-14 shrink-0 items-center gap-1 border-b border-admin-line pr-14 pl-5"
      >
        <span class="mr-auto text-xs text-admin-muted tabular-nums">
          {{ t('cmsAdmin.review.position', { index: index + 1, total }) }}
        </span>
        <AdminButton
          variant="ghost"
          size="icon"
          :disabled="disabled || index === 0"
          :aria-label="t('cmsAdmin.review.previous')"
          @click="emit('step', -1)"
        >
          <ChevronUp class="size-4" />
        </AdminButton>
        <AdminButton
          variant="ghost"
          size="icon"
          :disabled="disabled || index === total - 1"
          :aria-label="t('cmsAdmin.review.next')"
          @click="emit('step', 1)"
        >
          <ChevronDown class="size-4" />
        </AdminButton>
      </header>

      <div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
        <div class="grid gap-2">
          <div
            class="flex flex-wrap items-center gap-3 text-xs text-admin-muted"
          >
            <ChangeTag :change="item.change" :locale />
            {{ t(`cmsAdmin.kind.${item.kind}`) }}
          </div>
          <DialogTitle class="text-lg leading-snug font-medium text-balance">
            {{ item.title }}
          </DialogTitle>
          <DialogDescription class="text-xs text-admin-muted">
            {{ subtitle }}
          </DialogDescription>
        </div>

        <CanonicalReviewDetails
          v-if="item.source === 'catalog' && item.canonical"
          :key="item.id"
          :item="item.canonical"
          :draft-rev
          :locale
        />
        <SubmissionReview
          v-else-if="item.source === 'submission'"
          :key="item.id"
          :item
          :locale
        />
        <CatalogReview v-else :key="item.id" :item :locale />
      </div>

      <footer
        class="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-t border-admin-line px-5 py-3"
      >
        <AdminButton
          v-if="item.source === 'catalog' && item.canonical && canEdit"
          variant="dangerGhost"
          :icon="Trash2"
          :disabled
          @click="emit('discard')"
          >{{ t('cccStaging.deleteChanges') }}</AdminButton
        >
        <UndoChangeButton
          v-else-if="item.source === 'catalog' && canEdit"
          :key="item.id"
          :csrf
          :uid="item.id"
          :title="item.title"
          :published="item.change !== 'new'"
          destination="/admin/"
          :locale
        />
        <DeleteSubmissionButton
          v-else-if="item.source === 'submission' && canApply"
          :key="item.id"
          :item
          :csrf
          :locale
        />
        <span class="ml-auto flex flex-wrap items-center gap-1">
          <AdminButton
            v-if="canApply"
            :variant="selected ? 'secondary' : 'primary'"
            :icon="selected ? Check : Plus"
            :aria-pressed="selected"
            :disabled
            @click="emit('select')"
          >
            {{
              selected ? t('cmsAdmin.review.picked') : t('cmsAdmin.review.pick')
            }}
          </AdminButton>
        </span>
      </footer>
    </AdminSheetContent>
  </Sheet>
</template>
