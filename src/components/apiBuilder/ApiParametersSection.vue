<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { ApiParameter } from './apiSpec'
import { isMediaParameter } from './apiSpec'
import ApiDocsSection from './ApiDocsSection.vue'

const { parameters } = defineProps<{ parameters: ApiParameter[] }>()

const { t } = useI18n()

const MAX_ENUM_PREVIEW = 6

function constraintEntries(
  parameter: ApiParameter
): { label: string; value: string }[] {
  const entries: { label: string; value: string }[] = []
  if (isMediaParameter(parameter)) {
    entries.push({
      label: t('apiBuilder.acceptsLabel'),
      value: t('apiBuilder.mediaAccepts')
    })
    return entries
  }
  if (parameter.defaultValue !== undefined) {
    entries.push({
      label: t('apiBuilder.defaultLabel'),
      value: JSON.stringify(parameter.defaultValue)
    })
  }
  if (parameter.minimum !== undefined) {
    entries.push({
      label: t('apiBuilder.minLabel'),
      value: String(parameter.minimum)
    })
  }
  if (parameter.maximum !== undefined) {
    entries.push({
      label: t('apiBuilder.maxLabel'),
      value: String(parameter.maximum)
    })
  }
  if (parameter.enumValues?.length) {
    const preview = parameter.enumValues.slice(0, MAX_ENUM_PREVIEW).join(', ')
    const overflow = parameter.enumValues.length - MAX_ENUM_PREVIEW
    entries.push({
      label: t('apiBuilder.optionsLabel'),
      value:
        overflow > 0
          ? t('apiBuilder.optionsOverflow', { preview, count: overflow })
          : preview
    })
  }
  return entries
}
</script>

<template>
  <ApiDocsSection
    :title="t('apiBuilder.parametersTitle')"
    :description="t('apiBuilder.parametersDescription')"
  >
    <p v-if="!parameters.length" class="m-0 text-sm text-muted-foreground">
      {{ t('apiBuilder.parametersEmpty') }}
    </p>
    <ul v-else class="m-0 flex list-none flex-col p-0">
      <li
        v-for="parameter in parameters"
        :key="parameter.name"
        class="flex flex-col gap-1 border-b border-border-subtle py-3 first:pt-0 last:border-b-0 last:pb-0"
      >
        <div class="flex flex-wrap items-center gap-2">
          <code class="font-mono text-sm font-semibold">
            {{ parameter.name }}
          </code>
          <span
            class="rounded-md bg-secondary-background px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
          >
            {{ parameter.type }}
          </span>
          <span
            v-if="parameter.required"
            class="rounded-md bg-warning-background/20 px-1.5 py-0.5 text-xs text-warning-background"
          >
            {{ t('apiBuilder.requiredLabel') }}
          </span>
          <span class="ml-auto truncate text-xs text-muted-foreground">
            {{ parameter.nodeTitle }}
          </span>
        </div>
        <div
          v-if="constraintEntries(parameter).length"
          class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
        >
          <span
            v-for="entry in constraintEntries(parameter)"
            :key="entry.label"
          >
            {{ entry.label }}:
            <code class="font-mono">{{ entry.value }}</code>
          </span>
        </div>
      </li>
    </ul>
  </ApiDocsSection>
</template>
