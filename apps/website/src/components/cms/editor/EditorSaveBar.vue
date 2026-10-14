<script setup lang="ts">
import { Save } from '@lucide/vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  blocked,
  busy,
  locale = 'en'
} = defineProps<{
  blocked: boolean
  busy: boolean
  locale?: Locale
}>()
const emit = defineEmits<{ discard: [] }>()
const { t } = translationsFor(locale)
</script>

<template>
  <div
    role="region"
    :aria-label="t('cccEditorActions.unsaved')"
    class="fixed inset-x-0 bottom-0 z-40 border-t border-admin-line bg-admin-chrome/95 backdrop-blur-sm"
  >
    <div
      class="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-2 px-5 py-3 sm:px-8"
    >
      <span class="mr-auto text-xs text-admin-muted">{{
        t('cccEditorActions.unsaved')
      }}</span>
      <AdminButton variant="ghost" :disabled="busy" @click="emit('discard')">
        {{ t('cccEditorActions.discard') }}
      </AdminButton>
      <AdminButton
        type="submit"
        variant="primary"
        :icon="Save"
        :disabled="blocked"
        class="bg-primary-comfy-yellow text-primary-comfy-ink hover:bg-primary-comfy-yellow/90"
      >
        {{ t(busy ? 'cmsEditor.saving' : 'cmsEditor.save') }}
      </AdminButton>
    </div>
  </div>
</template>
