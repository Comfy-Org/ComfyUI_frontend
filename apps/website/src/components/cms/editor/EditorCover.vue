<script setup lang="ts">
import EditorField from '@/components/cms/editor/EditorField.vue'
import EditorMedia from '@/components/cms/editor/EditorMedia.vue'
import EditorSection from '@/components/cms/editor/EditorSection.vue'
import AdminSegmented from '@/components/cms/ui/AdminSegmented.vue'
import { fieldClass } from '@/components/cms/ui/field'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { EditorState, MediaKind } from '@/lib/cms/editor'

const { missing, locale = 'en' } = defineProps<{
  missing: boolean
  locale?: Locale
}>()
const cover = defineModel<EditorState['cover']>({ required: true })
const { t } = translationsFor(locale)
const mediaKinds: ReadonlyArray<{ value: MediaKind; label: string }> = [
  { value: 'image', label: t('cmsAdmin.editor.media.image') },
  { value: 'video', label: t('cmsAdmin.editor.media.video') }
]
</script>

<template>
  <EditorSection
    :title="t('cmsAdmin.editor.cover')"
    :description="t('cmsAdmin.editor.coverHelp')"
  >
    <div class="grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
      <EditorMedia :url="cover.url" :kind="cover.kind" class="aspect-4/3" />
      <div class="grid content-start gap-3">
        <AdminSegmented
          v-model="cover.kind"
          :options="mediaKinds"
          :label="t('cmsAdmin.editor.media.kind')"
        />
        <EditorField
          :label="t('cmsAdmin.editor.media.url')"
          :error="missing ? t('cmsAdmin.editor.problem.cover') : undefined"
        >
          <input
            v-model="cover.url"
            type="url"
            :placeholder="t('cmsAdmin.editor.media.placeholder')"
            :class="fieldClass"
          />
        </EditorField>
      </div>
    </div>
  </EditorSection>
</template>
