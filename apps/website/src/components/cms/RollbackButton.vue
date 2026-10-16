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
  targetRevision,
  locale = 'en'
} = defineProps<{
  csrf: string
  liveId: number
  /** Restores this past revision; leaving it out rolls back one publish. */
  targetRevision?: number
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const open = ref(false)
</script>

<template>
  <AdminButton
    :variant="targetRevision === undefined ? 'dangerGhost' : 'ghost'"
    @click="open = true"
  >
    {{
      t(
        targetRevision === undefined
          ? 'cmsAdmin.history.rollback'
          : 'cmsAdmin.history.restore'
      )
    }}
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
          {{
            targetRevision === undefined
              ? t('cmsAdmin.history.rollbackTitle')
              : t('cmsAdmin.history.restoreTitle', {
                  revision: targetRevision
                })
          }}
        </DialogTitle>
        <DialogDescription class="text-sm text-admin-muted">
          {{
            targetRevision === undefined
              ? t('cmsAdmin.history.rollbackBody')
              : t('cmsAdmin.history.restoreBody', {
                  revision: targetRevision
                })
          }}
        </DialogDescription>
        <input type="hidden" name="csrf" :value="csrf" />
        <input type="hidden" name="action" value="revert" />
        <input type="hidden" name="confirm" value="yes" />
        <input type="hidden" name="live_id" :value="liveId" />
        <input
          v-if="targetRevision !== undefined"
          type="hidden"
          name="target_id"
          :value="targetRevision"
        />
        <div class="flex flex-wrap justify-end gap-2 pt-1">
          <AdminButton @click="open = false">
            {{ t('cmsAdmin.publish.cancel') }}
          </AdminButton>
          <AdminButton type="submit" variant="danger">
            {{
              t(
                targetRevision === undefined
                  ? 'cmsAdmin.history.confirm'
                  : 'cmsAdmin.history.restore'
              )
            }}
          </AdminButton>
        </div>
      </form>
    </AdminDialogContent>
  </Dialog>
</template>
