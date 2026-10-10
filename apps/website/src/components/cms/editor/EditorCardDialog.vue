<script setup lang="ts">
import { DialogDescription, DialogTitle } from 'reka-ui'
import { computed } from 'vue'

import HubCardPreview from '@/components/cms/HubCardPreview.vue'
import AdminDialogContent from '@/components/cms/ui/AdminDialogContent.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { EditorState } from '@/lib/cms/editor'

/** The Hub card built from the unsaved form, shown on request. */
const { state, locale = 'en' } = defineProps<{
  state: EditorState
  locale?: Locale
}>()
const open = defineModel<boolean>('open', { required: true })
const { t } = translationsFor(locale)
const badge = computed(() => {
  if (!state.enabled)
    return { label: t('cmsAdmin.content.hidden'), tone: 'muted' as const }
  if (state.visibility === 'STAFF')
    return { label: t('cmsAdmin.editor.staff'), tone: 'muted' as const }
  if (state.visibleFrom)
    return {
      label: t('cmsAdmin.preview.card.scheduled'),
      tone: 'warning' as const
    }
  return undefined
})
</script>

<template>
  <Dialog v-model:open="open">
    <AdminDialogContent :close-label="t('cmsAdmin.review.close')">
      <DialogTitle class="pr-8 text-base font-medium">
        {{ t('cmsAdmin.editor.card.title') }}
      </DialogTitle>
      <DialogDescription class="text-sm text-admin-muted">
        {{ t('cmsAdmin.editor.card.help') }}
      </DialogDescription>
      <div class="grid justify-items-center py-2">
        <HubCardPreview
          :kind="state.kind"
          :title="state.name || t('cmsAdmin.editor.card.untitled')"
          :description="state.summary"
          :byline="state.credit"
          :media="state.cover.url ? state.cover : undefined"
          :badge
          :empty-label="t('cmsAdmin.editor.card.noCover')"
        />
      </div>
    </AdminDialogContent>
  </Dialog>
</template>
