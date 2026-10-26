<script setup lang="ts">
import { useMounted } from '@vueuse/core'
import { computed } from 'vue'

import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
import { t } from '@/i18n/translations'
import { SHELF_CARD } from '@/lib/workshop/card-layout'
import { useWorkshopWorkflowsEnabled } from '@/scripts/posthog'
import CardRow from './CardRow.vue'
import WorkshopModelCard from './WorkshopModelCard.vue'

const { workflows } = defineProps<{
  workflows: readonly WorkflowWorkshopModel[]
}>()

const mounted = useMounted()
const workflowsEnabled = useWorkshopWorkflowsEnabled()
const shown = computed(
  () => mounted.value && workflowsEnabled.value && workflows.length > 0
)
</script>

<template>
  <section
    v-if="shown"
    aria-labelledby="model-file-used-by"
    class="mx-auto max-w-7xl px-6 pb-16 lg:px-8"
    data-testid="model-file-used-by"
  >
    <CardRow>
      <template #heading>
        <h2
          id="model-file-used-by"
          class="text-2xl font-bold text-primary-comfy-canvas"
        >
          {{ t('workshop.file.usedBy') }}
        </h2>
      </template>
      <li
        v-for="workflow in workflows"
        :key="workflow.slug"
        :class="SHELF_CARD"
      >
        <WorkshopModelCard :model="workflow" under-heading />
      </li>
    </CardRow>
  </section>
</template>
