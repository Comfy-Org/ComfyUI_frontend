<script setup lang="ts">
import { Trash2, RotateCcw } from '@lucide/vue'
import { DialogRoot, DialogTitle, DialogDescription } from 'reka-ui'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import AdminDialogContent from '@/components/cms/ui/AdminDialogContent.vue'
import type { EditorSnapshot } from '@/lib/cms/editor-document'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
const { snapshot, unsaved, blocked, saving, title, locale } = defineProps<{
  snapshot: EditorSnapshot
  unsaved: boolean
  blocked: boolean
  saving: boolean
  title: string
  locale: Locale
}>()
const deleting = defineModel<boolean>({ required: true })
const emit = defineEmits<{ delete: []; undelete: [] }>()
const t = translationsFor(locale).t
</script>
<template>
  <section
    class="grid gap-3 rounded-xl border border-admin-line bg-admin-card p-5"
  >
    <h2 class="text-sm font-medium">
      {{ t('cccEditorDelete.heading') }}
    </h2>
    <p class="text-sm text-admin-muted">
      {{ t('cccEditorDelete.help') }}
    </p>
    <p v-if="unsaved" class="text-xs text-admin-muted">
      {{ t('cccEditorDelete.saveFirst') }}
    </p>
    <div>
      <AdminButton
        v-if="snapshot.is_deleted"
        :icon="RotateCcw"
        :disabled="blocked"
        @click="emit('undelete')"
        >{{ t('cccEditorDelete.undelete') }}</AdminButton
      >
      <AdminButton
        v-else
        variant="dangerGhost"
        :icon="Trash2"
        :disabled="blocked || unsaved"
        @click="deleting = true"
        >{{ t('cccEditorDelete.delete') }}</AdminButton
      >
    </div>
  </section>
  <DialogRoot :open="deleting" @update:open="!saving && (deleting = $event)">
    <AdminDialogContent
      v-if="deleting"
      :close-label="t('cccStaging.close')"
      :close-disabled="saving"
      @escape-key-down="saving && $event.preventDefault()"
      @pointer-down-outside="saving && $event.preventDefault()"
    >
      <DialogTitle>{{
        t('cccEditorDelete.confirmTitle', {
          name: title || snapshot?.uid || ''
        })
      }}</DialogTitle>
      <DialogDescription>{{ t('cccEditorDelete.help') }}</DialogDescription>
      <div class="flex justify-end gap-2">
        <AdminButton :disabled="saving" @click="deleting = false">{{
          t('cmsEditor.cancel')
        }}</AdminButton>
        <AdminButton
          variant="danger"
          :disabled="blocked"
          @click="emit('delete')"
          >{{ t('cccEditorDelete.confirm') }}</AdminButton
        >
      </div>
    </AdminDialogContent>
  </DialogRoot>
</template>
