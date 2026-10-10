<script setup lang="ts">
import { DialogDescription, DialogTitle } from 'reka-ui'

import AdminButton from '@/components/cms/ui/AdminButton.vue'
import { fieldClass } from '@/components/cms/ui/field'
import AdminDialogContent from '@/components/cms/ui/AdminDialogContent.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { SubmissionQueueItem } from '@/lib/cms/queue'

const {
  items,
  csrf,
  locale = 'en'
} = defineProps<{
  items: SubmissionQueueItem[]
  csrf: string
  locale?: Locale
}>()
const open = defineModel<boolean>('open', { required: true })
const { t } = translationsFor(locale)
const reasons = ['broken', 'description', 'outputs', 'duplicate', 'other']
const field = fieldClass
</script>

<template>
  <Dialog v-model:open="open">
    <AdminDialogContent :close-label="t('cmsAdmin.review.close')">
      <form
        data-astro-reload
        method="post"
        action="/admin/actions"
        class="grid gap-4"
      >
        <DialogTitle class="pr-8 text-base font-medium text-balance">
          {{
            items.length === 1
              ? t('cmsAdmin.reject.title', { title: items[0].title })
              : t('cmsAdmin.reject.titleMany', { count: items.length })
          }}
        </DialogTitle>
        <DialogDescription class="text-sm text-admin-muted">
          {{ t('cmsAdmin.reject.body') }}
        </DialogDescription>
        <input type="hidden" name="csrf" :value="csrf" />
        <input type="hidden" name="action" value="reject" />
        <input type="hidden" name="confirm" value="yes" />
        <input
          v-for="item in items"
          :key="item.id"
          type="hidden"
          name="submission"
          :value="`${item.shareId}:${item.versionId}`"
        />
        <label class="grid gap-1.5 text-xs text-admin-muted">
          {{ t('cmsAdmin.reject.reason') }}
          <select name="reason" :class="field">
            <option v-for="reason in reasons" :key="reason" :value="reason">
              {{ t(`cmsAdmin.reject.reasons.${reason}`) }}
            </option>
          </select>
        </label>
        <label class="grid gap-1.5 text-xs text-admin-muted">
          {{ t('cmsAdmin.reject.note') }}
          <textarea
            name="note"
            rows="3"
            :placeholder="t('cmsAdmin.reject.notePlaceholder')"
            :class="field"
          />
          <span class="text-admin-subtle">{{
            t('cmsAdmin.reject.noteApi')
          }}</span>
        </label>
        <div class="flex flex-wrap justify-end gap-2 pt-1">
          <AdminButton @click="open = false">
            {{ t('cmsAdmin.publish.cancel') }}
          </AdminButton>
          <AdminButton type="submit" variant="danger">
            {{ t('cmsAdmin.reject.confirm') }}
          </AdminButton>
        </div>
      </form>
    </AdminDialogContent>
  </Dialog>
</template>
