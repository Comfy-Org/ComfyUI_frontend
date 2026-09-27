<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import type { WorkflowWorkshopModelDetail } from '../../config/models-catalogue'
import { t } from '../../i18n/translations'

const { model, cloudHref } = defineProps<{
  model: WorkflowWorkshopModelDetail
  cloudHref?: string
}>()
</script>

<template>
  <section
    id="workflow-panel-workflow"
    role="tabpanel"
    aria-labelledby="workflow-tab-workflow"
    class="space-y-5 rounded-2xl border border-transparency-white-t20 p-5 lg:p-6"
  >
    <h2 class="text-lg font-medium text-primary-comfy-canvas">
      {{ t('workshop.workflow.inside') }}
    </h2>
    <p class="text-sm/relaxed text-primary-warm-gray">
      {{ t('workshop.workflow.previewHint') }}
    </p>
    <a
      v-if="model.workflow.template?.previewUrl"
      :href="model.workflow.template.previewUrl"
      target="_blank"
      rel="noopener"
      :aria-label="t('workshop.workflow.fullPreview')"
      class="block overflow-hidden rounded-xl border border-transparency-white-t8 focus-visible:outline-primary-comfy-yellow"
    >
      <img
        :src="model.workflow.template.previewUrl"
        :alt="t('workshop.workflow.graph')"
        loading="lazy"
        class="max-h-160 w-full object-contain"
      />
    </a>
    <div class="flex flex-wrap gap-3">
      <Button
        v-if="cloudHref"
        as="a"
        :href="cloudHref"
        target="_blank"
        rel="noopener"
        >{{ t('workshop.workflow.tryCloud') }}</Button
      >
      <Button
        v-if="model.workflow.template?.downloadUrl"
        as="a"
        :href="model.workflow.template.downloadUrl"
        download
        variant="outline"
        class="h-auto min-h-11 max-w-full whitespace-normal"
        >{{ t('workshop.workflow.download') }}</Button
      >
    </div>
  </section>
</template>
