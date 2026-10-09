<script setup lang="ts">
import EditorSection from '@/components/cms/editor/EditorSection.vue'
import AdminSegmented from '@/components/cms/ui/AdminSegmented.vue'
import { fieldClass } from '@/components/cms/ui/field'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { EditorParameter, Placement } from '@/lib/cms/editor'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const parameters = defineModel<EditorParameter[]>({ required: true })
const { t } = translationsFor(locale)

const placements = (parameter: EditorParameter) =>
  (['basic', 'advanced', 'hidden'] as const)
    .filter((value) => value !== 'hidden' || !parameter.required)
    .map((value): { value: Placement; label: string } => ({
      value,
      label: t(`cmsAdmin.editor.parameters.${value}`)
    }))
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
      <div
        v-for="parameter in parameters"
        :key="parameter.name"
        role="row"
        class="grid gap-3 border-b border-admin-hover px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_15rem] md:items-center md:gap-4"
      >
        <div role="cell" class="grid min-w-0 gap-0.5">
          <span class="flex items-center gap-2">
            <code class="truncate font-mono text-xs">{{ parameter.name }}</code>
            <span v-if="parameter.required" class="text-xs text-admin-warning">
              {{ t('cmsAdmin.editor.parameters.required') }}
            </span>
          </span>
          <span
            v-if="parameter.description"
            class="line-clamp-2 text-xs text-admin-muted"
            :title="parameter.description"
          >
            {{ parameter.description }}
          </span>
        </div>
        <div role="cell">
          <select
            v-if="parameter.options.length || parameter.type === 'boolean'"
            v-model="parameter.defaultValue"
            :aria-label="`${parameter.name} ${t('cmsAdmin.editor.parameters.default')}`"
            :class="fieldClass"
          >
            <option value="">
              {{ t('cmsAdmin.editor.parameters.noDefault') }}
            </option>
            <option
              v-for="option in parameter.options.length
                ? parameter.options
                : ['true', 'false']"
              :key="option"
              :value="option"
            >
              {{ option }}
            </option>
          </select>
          <input
            v-else
            v-model="parameter.defaultValue"
            :type="
              parameter.type === 'integer' || parameter.type === 'number'
                ? 'number'
                : 'text'
            "
            :aria-label="`${parameter.name} ${t('cmsAdmin.editor.parameters.default')}`"
            :placeholder="t('cmsAdmin.editor.parameters.noDefault')"
            :class="fieldClass"
          />
        </div>
        <div role="cell">
          <AdminSegmented
            v-model="parameter.placement"
            :options="placements(parameter)"
            :label="`${parameter.name} ${t('cmsAdmin.editor.parameters.shownAs')}`"
            size="sm"
          />
        </div>
      </div>
    </div>
  </EditorSection>
</template>
