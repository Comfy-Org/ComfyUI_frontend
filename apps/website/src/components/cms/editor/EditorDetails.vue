<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import EditorField from '@/components/cms/editor/EditorField.vue'
import EditorTags from '@/components/cms/editor/EditorTags.vue'
import EditorUseCases from '@/components/cms/editor/EditorUseCases.vue'
import EditorSection from '@/components/cms/editor/EditorSection.vue'
import AdminSegmented from '@/components/cms/ui/AdminSegmented.vue'
import { fieldClass } from '@/components/cms/ui/field'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { EditorState } from '@/lib/cms/editor'
import { HUB_SECTION, pageSlug, slugify } from '@/lib/cms/editor'

const { problems, locale = 'en' } = defineProps<{
  /** The fields still missing, once the reader has tried to save. */
  problems: string[]
  locale?: Locale
}>()
const state = defineModel<EditorState>({ required: true })
const { t } = translationsFor(locale)

const language = ref<'en' | 'zh-CN'>('en')
const languages = [
  { value: 'en' as const, label: 'English' },
  { value: 'zh-CN' as const, label: '中文' }
]
const section = HUB_SECTION[state.value.kind]
const slugTouched = ref(!state.value.isNew)
const slugEnd = computed({
  get: () => state.value.slug.split('/').pop() ?? '',
  set: (value: string) => {
    slugTouched.value = true
    state.value.slug = `/hub/${section}/${slugify(value)}`
  }
})
watch(
  () => state.value.name,
  (name) => {
    if (state.value.isNew && !slugTouched.value)
      state.value.slug = pageSlug(state.value.kind, name)
  }
)
const problem = (field: string) =>
  problems.includes(field) ? t(`cmsAdmin.editor.problem.${field}`) : undefined
const runModes = [
  { value: 'run' as const, label: t('cmsAdmin.editor.runsOnHub.yes') },
  { value: 'graph' as const, label: t('cmsAdmin.editor.runsOnHub.no') }
]
const runMode = computed({
  get: () => (state.value.runsOnHub ? 'run' : 'graph'),
  set: (mode: 'run' | 'graph') => {
    state.value.runsOnHub = mode === 'run'
  }
})
const creditLabel =
  state.value.kind === 'MODEL'
    ? t('cmsAdmin.editor.provider')
    : t('cmsAdmin.editor.author')
</script>

<template>
  <EditorSection
    :title="t('cmsAdmin.editor.details')"
    :description="
      language === 'en'
        ? t('cmsAdmin.editor.detailsHelp')
        : t('cmsAdmin.editor.translationHelp')
    "
  >
    <template #actions>
      <AdminSegmented
        v-model="language"
        :options="languages"
        :label="t('cmsAdmin.editor.language')"
      />
    </template>
    <template v-if="language === 'en'">
      <EditorField :label="t('cmsAdmin.editor.name')" :error="problem('name')">
        <input v-model="state.name" :class="fieldClass" />
      </EditorField>
      <EditorField :label="t('cmsAdmin.editor.summary')">
        <textarea v-model="state.summary" rows="3" :class="fieldClass" />
      </EditorField>
      <div class="grid gap-4 md:grid-cols-2">
        <EditorField v-if="state.kind !== 'APP'" :label="creditLabel">
          <input v-model="state.credit" :class="fieldClass" />
        </EditorField>
        <EditorField :label="t('cmsAdmin.editor.tags')" as="div">
          <EditorTags
            v-model="state.tags"
            :label="t('cmsAdmin.editor.tags')"
            :locale
          />
        </EditorField>
      </div>
      <EditorUseCases
        v-if="state.kind !== 'APP'"
        v-model="state.useCases"
        :locale
      />
      <EditorField
        v-if="state.kind === 'WORKFLOW'"
        :label="t('cmsAdmin.editor.runsOnHub.label')"
        :hint="t('cmsAdmin.editor.runsOnHub.help')"
      >
        <AdminSegmented
          v-model="runMode"
          :options="runModes"
          :label="t('cmsAdmin.editor.runsOnHub.label')"
          class="justify-self-start"
        />
      </EditorField>
      <EditorField
        :label="t('cmsAdmin.editor.address')"
        :error="problem('slug')"
        :hint="state.isNew ? undefined : t('cmsAdmin.editor.addressFixed')"
      >
        <span
          class="flex items-center rounded-lg border border-admin-field bg-admin-page text-sm has-focus-visible:border-admin-control"
        >
          <span class="pl-3 text-admin-subtle">/hub/{{ section }}/</span>
          <input
            v-model.lazy="slugEnd"
            :disabled="!state.isNew"
            class="min-w-0 flex-1 bg-transparent py-2 pr-3 text-admin-fg outline-none disabled:cursor-not-allowed disabled:text-admin-muted"
          />
        </span>
      </EditorField>
    </template>
    <template v-else>
      <EditorField :label="t('cmsAdmin.editor.name')">
        <input
          v-model="state.translation.name"
          lang="zh-CN"
          :placeholder="state.name"
          :class="fieldClass"
        />
      </EditorField>
      <EditorField :label="t('cmsAdmin.editor.summary')">
        <textarea
          v-model="state.translation.summary"
          lang="zh-CN"
          rows="3"
          :placeholder="state.summary"
          :class="fieldClass"
        />
      </EditorField>
    </template>
  </EditorSection>
</template>
