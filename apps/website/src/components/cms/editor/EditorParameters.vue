<script setup lang="ts">
import EditorSection from '@/components/cms/editor/EditorSection.vue'
import EditorParameterRow from '@/components/cms/editor/EditorParameterRow.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { EditorParameter } from '@/lib/cms/editor'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const parameters = defineModel<EditorParameter[]>({ required: true })
const { t } = translationsFor(locale)
</script>

<template>
  <EditorSection
    :title="t('cmsAdmin.editor.parameters.title')"
    :description="t('cmsAdmin.editor.parameters.help')"
  >
    <div
      role="table"
      class="overflow-hidden rounded-lg border border-admin-line text-sm"
    >
      <div
        role="row"
        class="hidden grid-cols-[minmax(0,1fr)_minmax(0,14rem)_15rem] gap-4 border-b border-admin-line px-4 py-2 text-xs font-medium tracking-[0.06em] text-admin-muted uppercase md:grid"
      >
        <span role="columnheader">{{
          t('cmsAdmin.editor.parameters.name')
        }}</span>
        <span role="columnheader">{{
          t('cmsAdmin.editor.parameters.default')
        }}</span>
        <span role="columnheader">{{
          t('cmsAdmin.editor.parameters.shownAs')
        }}</span>
      </div>
      <EditorParameterRow
        v-for="(parameter, index) in parameters"
        :key="parameter.name"
        v-model="parameters[index]"
        :locale
      />
    </div>
  </EditorSection>
</template>
