<script setup lang="ts">
import { ref } from 'vue'

import { DialogDescription, DialogTitle } from 'reka-ui'

import AdminButton from '@/components/cms/ui/AdminButton.vue'
import AdminDialogContent from '@/components/cms/ui/AdminDialogContent.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  csrf,
  liveId,
  locale = 'en'
} = defineProps<{ csrf: string; liveId: number; locale?: Locale }>()
const { t } = translationsFor(locale)
const open = ref(false)
</script>

<template>
  <AdminButton variant="dangerGhost" @click="open = true">
    {{ t('cmsAdmin.history.rollback') }}
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
          {{ t('cmsAdmin.history.rollbackTitle') }}
        </DialogTitle>
        <DialogDescription class="text-sm text-admin-muted">
          {{ t('cmsAdmin.history.rollbackBody') }}
        </DialogDescription>
        <input type="hidden" name="csrf" :value="csrf" />
        <input type="hidden" name="action" value="revert" />
        <input type="hidden" name="confirm" value="yes" />
        <input type="hidden" name="live_id" :value="liveId" />
        <div class="flex flex-wrap justify-end gap-2 pt-1">
          <AdminButton @click="open = false">
            {{ t('cmsAdmin.publish.cancel') }}
          </AdminButton>
          <AdminButton type="submit" variant="danger">
            {{ t('cmsAdmin.history.confirm') }}
          </AdminButton>
        </div>
      </form>
    </AdminDialogContent>
  </Dialog>
</template>
