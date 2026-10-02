<script setup lang="ts">
import type { WorkflowWorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import WorkshopCardMedia from './WorkshopCardMedia.vue'

const { workflow, locale = 'en' } = defineProps<{
  workflow: WorkflowWorkshopModel
  locale?: Locale
}>()
</script>

<template>
  <a
    :href="workflow.href"
    class="group grid h-full grid-cols-2 gap-4 overflow-hidden rounded-3xl bg-hub-surface p-2 transition-colors duration-200 outline-none hover:bg-hub-surface-hover focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
    data-testid="use-case-card"
  >
    <div class="flex flex-col justify-between gap-3 p-2">
      <span
        class="w-fit rounded-full bg-transparency-white-t4 px-2.5 py-1 text-xs text-content-secondary"
      >
        {{ t('workshop.explore.workflowPill', locale) }}
      </span>
      <h3 class="text-base/6 font-medium text-content-bright">
        {{ workflow.name }}
      </h3>
    </div>
    <div class="relative aspect-4/3 overflow-hidden rounded-2xl">
      <WorkshopCardMedia :model="workflow" />
      <span
        v-if="workflow.models?.length"
        class="absolute right-2 bottom-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-site-dropdown/80 px-2.5 py-1 text-xs whitespace-nowrap text-primary-warm-white backdrop-blur-md"
        data-testid="use-case-by"
      >
        {{ t('workshop.explore.by', locale, { model: workflow.models[0] }) }}
      </span>
    </div>
  </a>
</template>
