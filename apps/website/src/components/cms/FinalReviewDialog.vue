<script setup lang="ts">
import { DialogDescription, DialogTitle } from 'reka-ui'
import { computed } from 'vue'

import ChangeTag from '@/components/cms/ChangeTag.vue'
import ReadinessFlag from '@/components/cms/ReadinessFlag.vue'

import AdminButton from '@/components/cms/ui/AdminButton.vue'
import AdminDialogContent from '@/components/cms/ui/AdminDialogContent.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { QueueItem } from '@/lib/cms/queue'

const {
  items,
  laterCount,
  csrf,
  draftId,
  generation,
  locale = 'en'
} = defineProps<{
  /** The approved changes, all of which go live together. */
  items: QueueItem[]
  /** Changes left for later, which stay in the draft. */
  laterCount: number
  csrf: string
  draftId: number
  generation: number
  locale?: Locale
}>()
const open = defineModel<boolean>('open', { required: true })
const { t } = translationsFor(locale)
const flagged = computed(
  () =>
    items.filter((item) => item.source === 'catalog' && item.gaps.length).length
)
</script>

<template>
  <Dialog v-model:open="open">
    <AdminDialogContent :close-label="t('cmsAdmin.review.close')">
      <DialogTitle class="pr-8 text-base font-medium text-balance">
        {{ t('cmsAdmin.finalReview.title') }}
      </DialogTitle>
      <ul
        class="grid max-h-64 overflow-y-auto rounded-lg border border-admin-line"
      >
        <li
          v-for="item in items"
          :key="item.id"
          class="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 border-b border-admin-hover px-3 py-2 text-sm last:border-b-0"
        >
          <ChangeTag :change="item.change" :locale />
          <span class="flex min-w-0 items-center gap-2">
            <span class="truncate">{{ item.title }}</span>
            <ReadinessFlag
              v-if="item.source === 'catalog'"
              :gaps="item.gaps"
              :locale
              class="shrink-0 text-xs"
            />
          </span>
        </li>
      </ul>
      <DialogDescription class="grid gap-2 text-sm text-admin-muted">
        <span>{{
          t('cmsAdmin.finalReview.body', { count: items.length }, items.length)
        }}</span>
        <span v-if="flagged" class="text-admin-warning">
          {{ t('cmsAdmin.readiness.flagged', { count: flagged }, flagged) }}
        </span>
        <span v-if="laterCount">
          {{
            t('cmsAdmin.finalReview.later', { count: laterCount }, laterCount)
          }}
        </span>
      </DialogDescription>
      <form
        data-astro-reload
        method="post"
        action="/admin/actions"
        class="flex flex-wrap justify-end gap-2 pt-1"
      >
        <input type="hidden" name="csrf" :value="csrf" />
        <input type="hidden" name="action" value="publish" />
        <input type="hidden" name="confirm" value="yes" />
        <input type="hidden" name="draft_id" :value="draftId" />
        <input type="hidden" name="generation" :value="generation" />
        <template v-for="item in items" :key="item.id">
          <input
            v-if="item.source === 'submission'"
            type="hidden"
            name="approve"
            :value="`${item.shareId}:${item.versionId}`"
          />
          <input v-else type="hidden" name="approve_item" :value="item.id" />
        </template>
        <AdminButton @click="open = false">
          {{ t('cmsAdmin.publish.cancel') }}
        </AdminButton>
        <AdminButton type="submit" variant="primary">{{
          t(
            'cmsAdmin.finalReview.confirm',
            { count: items.length },
            items.length
          )
        }}</AdminButton>
      </form>
    </AdminDialogContent>
  </Dialog>
</template>
