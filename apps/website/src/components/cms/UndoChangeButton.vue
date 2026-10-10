<script setup lang="ts">
import { Undo2 } from '@lucide/vue'
import { DialogDescription, DialogTitle } from 'reka-ui'
import { ref } from 'vue'

import AdminButton from '@/components/cms/ui/AdminButton.vue'
import AdminDialogContent from '@/components/cms/ui/AdminDialogContent.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { SaveResult } from '@/lib/cms/save-item'

/** Puts one item back to its live version, or drops it if never published. */
const {
  csrf,
  uid,
  title,
  published,
  destination,
  locale = 'en'
} = defineProps<{
  csrf: string
  uid: string
  title: string
  published: boolean
  /** Where to land once the draft no longer holds the change. */
  destination: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const mode = published ? 'undo' : 'remove'
const open = ref(false)
const busy = ref(false)
const failed = ref(false)

async function confirm() {
  busy.value = true
  failed.value = false
  const form = new FormData()
  form.set('csrf', csrf)
  form.set('action', 'undo')
  form.set('uid', uid)
  try {
    const response = await fetch('/admin/actions', {
      method: 'POST',
      body: form
    })
    const result = (await response.json()) as SaveResult
    if (result.ok) {
      window.location.assign(destination)
      return
    }
  } catch {
    // Reported below like a refused undo.
  }
  failed.value = true
  busy.value = false
}
</script>

<template>
  <AdminButton variant="dangerGhost" :icon="Undo2" @click="open = true">
    {{ t(`cmsAdmin.undo.${mode}.action`) }}
  </AdminButton>
  <Dialog v-model:open="open">
    <AdminDialogContent :close-label="t('cmsAdmin.review.close')">
      <DialogTitle class="pr-8 text-base font-medium text-balance">
        {{ t(`cmsAdmin.undo.${mode}.title`, { title }) }}
      </DialogTitle>
      <DialogDescription class="text-sm text-admin-muted">
        {{ t(`cmsAdmin.undo.${mode}.body`) }}
      </DialogDescription>
      <p v-if="failed" role="alert" class="text-xs text-admin-danger-text">
        {{ t('cmsAdmin.undo.failed') }}
      </p>
      <div class="flex flex-wrap justify-end gap-2 pt-1">
        <AdminButton @click="open = false">
          {{ t('cmsAdmin.publish.cancel') }}
        </AdminButton>
        <AdminButton variant="danger" :disabled="busy" @click="confirm">
          {{ t(`cmsAdmin.undo.${mode}.confirm`) }}
        </AdminButton>
      </div>
    </AdminDialogContent>
  </Dialog>
</template>
