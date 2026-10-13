<script setup lang="ts">
import AdminSegmented from '@/components/cms/ui/AdminSegmented.vue'
import { fieldClass } from '@/components/cms/ui/field'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { EditorParameter, Placement } from '@/lib/cms/editor'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const parameter = defineModel<EditorParameter>({ required: true })
const { t } = translationsFor(locale)

const choices =
  parameter.value.type === 'boolean'
    ? ['true', 'false']
    : parameter.value.options
const inputType = ['integer', 'number'].includes(parameter.value.type)
  ? 'number'
  : 'text'
const placements = (['basic', 'advanced', 'hidden'] as const)
  .filter((value) => value !== 'hidden' || !parameter.value.required)
  .map((value): { value: Placement; label: string } => ({
    value,
    label: t(`cmsAdmin.editor.parameters.${value}`)
  }))
const defaultLabel = `${parameter.value.name} ${t('cmsAdmin.editor.parameters.default')}`
</script>

<template>
  <div
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
        class="line-clamp-2 text-xs text-admin-muted"
        :title="parameter.description"
      >
        {{ parameter.description }}
      </span>
    </div>
    <div role="cell">
      <select
        v-if="choices.length"
        v-model="parameter.defaultValue"
        :aria-label="defaultLabel"
        :class="fieldClass"
      >
        <option value="">
          {{ t('cmsAdmin.editor.parameters.noDefault') }}
        </option>
        <option v-for="choice in choices" :key="choice" :value="choice">
          {{ choice }}
        </option>
      </select>
      <input
        v-else
        v-model="parameter.defaultValue"
        :type="inputType"
        :aria-label="defaultLabel"
        :placeholder="t('cmsAdmin.editor.parameters.noDefault')"
        :class="fieldClass"
      />
    </div>
    <div role="cell">
      <AdminSegmented
        v-model="parameter.placement"
        :options="placements"
        :label="`${parameter.name} ${t('cmsAdmin.editor.parameters.shownAs')}`"
        size="sm"
      />
    </div>
  </div>
</template>
