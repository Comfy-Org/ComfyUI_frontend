<script setup lang="ts">
import { ChevronDown, ChevronUp } from '@lucide/vue'
import { DialogDescription, DialogTitle } from 'reka-ui'
import { computed, nextTick } from 'vue'

import AuthorName from '@/components/cms/AuthorName.vue'
import CatalogReview from '@/components/cms/CatalogReview.vue'
import ChangeTag from '@/components/cms/ChangeTag.vue'
import SubmissionReview from '@/components/cms/SubmissionReview.vue'
import ReviewSheetActions from './ReviewSheetActions.vue'
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
    : item.provider || !item.authorUID
      ? `${item.provider ?? t('cmsAdmin.draft.catalogSource')} · ${item.slug}`
      : item.slug
)
const author = computed(() =>
  item.source === 'catalog' && !item.provider ? item.authorUID : undefined
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
          <DialogDescription
            class="flex flex-wrap items-center gap-x-1.5 text-xs text-admin-muted"
          >
            <AuthorName v-if="author" :uid="author" :locale />
            <span v-if="author" aria-hidden="true">·</span>
            <span>{{ subtitle }}</span>
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

      <ReviewSheetActions
        :item
        :can-edit="canEdit"
        :can-apply="canApply"
        :selected
        :disabled
        :csrf
        :locale
        @discard="emit('discard')"
        @select="emit('select')"
      />
    </AdminSheetContent>
  </Sheet>
</template>
