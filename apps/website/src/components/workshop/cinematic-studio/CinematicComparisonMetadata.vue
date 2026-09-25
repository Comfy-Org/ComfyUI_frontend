<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import type { comparisonPanel } from './comparison-view'
import { tcComparison } from '../../../lib/workshop/cinematic-studio/comparison-copy'
import type { ComparisonCopyKey } from '../../../lib/workshop/cinematic-studio/comparison-copy'
const { panel, locale } = defineProps<{
  panel: ReturnType<typeof comparisonPanel>
  locale: Locale
}>()
const t = (key: ComparisonCopyKey) => tcComparison(key, locale)
</script>
<template>
  <dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
    <dt class="text-primary-comfy-canvas">{{ t('model') }}</dt>
    <dd class="wrap-break-word">{{ panel.modelName }}</dd>
    <dt class="text-primary-comfy-canvas">{{ t('aspect') }}</dt>
    <dd>{{ panel.settings.aspect }}</dd>
    <template v-if="panel.settings.resolution"
      ><dt class="text-primary-comfy-canvas">
        {{ t('resolution') }}
      </dt>
      <dd>{{ panel.settings.resolution }}</dd></template
    >
    <template v-if="panel.settings.duration !== undefined"
      ><dt class="text-primary-comfy-canvas">{{ t('duration') }}</dt>
      <dd>{{ panel.settings.duration }}s</dd></template
    >
    <template v-if="panel.settings.seed !== undefined"
      ><dt class="text-primary-comfy-canvas">{{ t('seed') }}</dt>
      <dd>{{ panel.settings.seed }}</dd></template
    >
    <template v-if="panel.settings.audio !== undefined"
      ><dt class="text-primary-comfy-canvas">{{ t('audio') }}</dt>
      <dd>{{ t(panel.settings.audio ? 'on' : 'off') }}</dd></template
    >
    <template v-if="panel.settings.operation"
      ><dt class="text-primary-comfy-canvas">{{ t('operation') }}</dt>
      <dd>{{ t(panel.settings.operation) }}</dd></template
    >
    <template v-if="panel.item.settings?.sourceId"
      ><dt class="text-primary-comfy-canvas">{{ t('source') }}</dt>
      <dd class="wrap-break-word">
        {{ panel.source?.name ?? t('sourceMissing') }}
      </dd></template
    >
  </dl>
</template>
