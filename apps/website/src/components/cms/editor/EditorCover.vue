<script setup lang="ts">
import EditorSection from '@/components/cms/editor/EditorSection.vue'
import MediaPicker from '@/components/cms/editor/MediaPicker.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { EditorState } from '@/lib/cms/editor'

const {
  missing,
  canUpload,
  locale = 'en'
} = defineProps<{
  missing: boolean
  canUpload: boolean
  locale?: Locale
}>()
const cover = defineModel<EditorState['cover']>({ required: true })
const { t } = translationsFor(locale)
</script>

<template>
  <EditorSection
    :title="t('cmsAdmin.editor.cover')"
    :description="t('cmsAdmin.editor.coverHelp')"
  >
    <MediaPicker
      v-model:url="cover.url"
      v-model:kind="cover.kind"
      :can-upload="canUpload"
      :missing="missing ? t('cmsAdmin.editor.problem.cover') : undefined"
      preview-class="aspect-4/3 md:max-w-sm"
      :locale
    />
  </EditorSection>
</template>
