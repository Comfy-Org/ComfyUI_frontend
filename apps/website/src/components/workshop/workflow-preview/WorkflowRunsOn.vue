<script setup lang="ts">
import { Box } from '@lucide/vue'

import { translationsFor } from '@/i18n/translations'
import WorkflowPartRow from '@/components/workshop/workflow-preview/WorkflowPartRow.vue'
import { GROUP_HEADING } from '@/components/workshop/workflow-preview/workflowFactsClasses'

const { t } = translationsFor('en')

defineProps<{ parts: readonly { name: string; href?: string }[] }>()
</script>

<template>
  <section data-testid="workflow-runs-on">
    <h3 :class="GROUP_HEADING">
      {{ t('workshop.workflow.runsOn') }}
    </h3>
    <ul class="mt-2 flex flex-col gap-1">
      <li v-for="part in parts" :key="part.name">
        <WorkflowPartRow
          :icon="Box"
          :name="part.name"
          :href="part.href"
          text-class="text-base"
        />
      </li>
    </ul>
  </section>
</template>
