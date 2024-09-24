<template>
  <div class="workflow-tabs">
    <SelectButton
      v-model="workflowStore.activeWorkflow"
      :options="workflowStore.openWorkflows"
      aria-labelledby="basic"
    />
  </div>
</template>

<script setup lang="ts">
import { useWorkflowStore } from '@/stores/workflowStore'
import SelectButton from 'primevue/selectbutton'

const workflowStore = useWorkflowStore()
</script>
