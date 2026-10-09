<script setup lang="ts">
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
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
  <Button
    variant="ghost"
    size="sm"
    class="text-destructive-light"
    @click="open = true"
  >
    {{ t('cmsAdmin.history.rollback') }}
  </Button>
  <Dialog v-model:open="open">
    <DialogContent :close-label="t('cmsAdmin.review.close')">
      <form
        data-astro-reload
        method="post"
        action="/admin/actions"
        class="grid gap-5"
      >
        <DialogTitle class="pr-14 text-2xl text-balance">
          {{ t('cmsAdmin.history.rollbackTitle') }}
        </DialogTitle>
        <DialogDescription>
          {{ t('cmsAdmin.history.rollbackBody') }}
        </DialogDescription>
        <input type="hidden" name="csrf" :value="csrf" />
        <input type="hidden" name="action" value="revert" />
        <input type="hidden" name="confirm" value="yes" />
        <input type="hidden" name="live_id" :value="liveId" />
        <div class="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="ghost" @click="open = false">
            {{ t('cmsAdmin.publish.cancel') }}
          </Button>
          <Button
            type="submit"
            class="bg-destructive-light text-primary-comfy-ink hover:bg-destructive-light/90"
          >
            {{ t('cmsAdmin.history.confirm') }}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
