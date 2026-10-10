<script setup lang="ts">
import { Check, ChevronDown, ChevronUp } from '@lucide/vue'
import { DialogDescription, DialogTitle } from 'reka-ui'
import { computed } from 'vue'

import CatalogReview from '@/components/cms/CatalogReview.vue'
import ChangeTag from '@/components/cms/ChangeTag.vue'
import SubmissionReview from '@/components/cms/SubmissionReview.vue'
import UndoChangeButton from '@/components/cms/UndoChangeButton.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import AdminSheetContent from '@/components/cms/ui/AdminSheetContent.vue'
import StatusLabel from '@/components/cms/ui/StatusLabel.vue'
import Sheet from '@/components/ui/sheet/Sheet.vue'
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
  csrf,
  locale = 'en'
} = defineProps<{
  item: QueueItem
  index: number
  total: number
  canApply: boolean
  canEdit: boolean
  csrf: string
  locale?: Locale
}>()
const open = defineModel<boolean>('open', { required: true })
const approved = defineModel<boolean>('approved', { required: true })
const emit = defineEmits<{ step: [direction: -1 | 1]; reject: [] }>()
const { t } = translationsFor(locale)

const subtitle = computed(() =>
  item.source === 'submission'
    ? `${item.author} · ${t('cmsAdmin.review.submitted', {
        date: formatUtc(item.submittedAt, locale)
      })}`
    : `${item.provider ?? t('cmsAdmin.draft.catalogSource')} · ${item.slug}`
)
const isSubmission = computed(() => item.source === 'submission')
</script>

<template>
  <Sheet v-model:open="open">
    <AdminSheetContent :close-label="t('cmsAdmin.review.close')">
      <header
        class="flex h-14 shrink-0 items-center gap-1 border-b border-admin-line pr-14 pl-5"
      >
        <span class="mr-auto text-xs text-admin-muted tabular-nums">
          {{ t('cmsAdmin.review.position', { index: index + 1, total }) }}
        </span>
        <AdminButton
          variant="ghost"
          size="icon"
          :disabled="index === 0"
          :aria-label="t('cmsAdmin.review.previous')"
          @click="emit('step', -1)"
        >
          <ChevronUp class="size-4" />
        </AdminButton>
        <AdminButton
          variant="ghost"
          size="icon"
          :disabled="index === total - 1"
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

        <SubmissionReview
          v-if="item.source === 'submission'"
          :key="item.id"
          :item
          :locale
        />
        <CatalogReview v-else :key="item.id" :item :locale />
      </div>

      <footer
        class="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-t border-admin-line px-5 py-3"
      >
        <template v-if="isSubmission && approved">
          <StatusLabel
            tone="success"
            :label="t('cmsAdmin.decision.approvedNote')"
            class="mr-auto"
          />
          <AdminButton
            v-if="canApply"
            variant="ghost"
            @click="approved = false"
          >
            {{ t('cmsAdmin.decision.undoApproval') }}
          </AdminButton>
        </template>
        <template v-else-if="isSubmission">
          <span class="mr-auto text-xs text-admin-muted">
            {{ t('cmsAdmin.decision.undecided') }}
          </span>
          <template v-if="canApply">
            <AdminButton variant="dangerGhost" @click="emit('reject')">
              {{ t('cmsAdmin.review.reject') }}
            </AdminButton>
            <AdminButton
              variant="primary"
              :icon="Check"
              @click="approved = true"
            >
              {{ t('cmsAdmin.decision.approve') }}
            </AdminButton>
          </template>
        </template>
        <template v-else>
          <p class="mr-auto text-xs text-admin-muted">
            {{ t('cmsAdmin.draft.catalogNote') }}
          </p>
          <UndoChangeButton
            v-if="canEdit"
            :key="item.id"
            :csrf
            :uid="item.id"
            :title="item.title"
            :published="item.change !== 'new'"
            destination="/admin/"
            :locale
          />
        </template>
      </footer>
    </AdminSheetContent>
  </Sheet>
</template>
