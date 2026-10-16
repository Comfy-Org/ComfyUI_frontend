<script setup lang="ts">
import { Trash2 } from '@lucide/vue'
import { DialogDescription, DialogTitle } from 'reka-ui'
import { ref } from 'vue'

import AdminButton from '@/components/cms/ui/AdminButton.vue'
import AdminDialogContent from '@/components/cms/ui/AdminDialogContent.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { SubmissionQueueItem } from '@/lib/cms/queue'

/** Takes a submitted workflow out of the draft for good. */
const {
  item,
  csrf,
  locale = 'en'
} = defineProps<{
  item: SubmissionQueueItem
  csrf: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const open = ref(false)
</script>

<template>
  <AdminButton variant="dangerGhost" :icon="Trash2" @click="open = true">
    {{ t('cmsAdmin.undo.remove.action') }}
  </AdminButton>
  <Dialog v-model:open="open">
    <AdminDialogContent :close-label="t('cmsAdmin.review.close')">
      <form
        data-astro-reload
        method="post"
        action="/admin/actions"
        class="grid gap-4"
      >
        <DialogTitle class="pr-8 text-base font-medium text-balance">
          {{ t('cmsAdmin.undo.remove.title', { title: item.title }) }}
        </DialogTitle>
        <DialogDescription class="text-sm text-admin-muted">
          {{ t('cmsAdmin.undo.remove.body') }}
        </DialogDescription>
        <input type="hidden" name="csrf" :value="csrf" />
        <input type="hidden" name="action" value="reject" />
        <input type="hidden" name="confirm" value="yes" />
        <input
          type="hidden"
          name="submission"
          :value="`${item.shareId}:${item.versionId}`"
        />
        <div class="flex flex-wrap justify-end gap-2 pt-1">
          <AdminButton @click="open = false">
            {{ t('cmsAdmin.publish.cancel') }}
          </AdminButton>
          <AdminButton type="submit" variant="danger">
            {{ t('cmsAdmin.undo.remove.confirm') }}
          </AdminButton>
        </div>
      </form>
    </AdminDialogContent>
  </Dialog>
</template>
