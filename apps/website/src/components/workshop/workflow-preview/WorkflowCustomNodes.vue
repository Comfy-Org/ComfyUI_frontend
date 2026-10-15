<script setup lang="ts">
import { Puzzle } from '@lucide/vue'

import { translationsFor } from '@/i18n/translations'
import WorkflowPartRow from '@/components/workshop/workflow-preview/WorkflowPartRow.vue'
import { GROUP_HEADING } from '@/components/workshop/workflow-preview/workflowFactsClasses'

const { t } = translationsFor('en')

defineProps<{ nodes: readonly string[] }>()
</script>

<template>
  <section data-testid="workflow-custom-nodes">
    <h3 :class="GROUP_HEADING">
      {{ t('workshop.workflow.requiresCustomNodes') }}
    </h3>
    <ul class="mt-2 flex flex-col gap-1">
      <li v-for="node in nodes" :key="node">
        <WorkflowPartRow :icon="Puzzle" :name="node" text-class="text-base" />
      </li>
    </ul>
  </section>
</template>
