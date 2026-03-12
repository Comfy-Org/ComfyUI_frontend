<template>
  <i
    v-if="state === 'running'"
    class="icon-[lucide--loader-circle] size-4 shrink-0 animate-spin text-muted-foreground"
    :aria-label="$t('workflowExecution.running')"
  />
  <i
    v-else-if="state === 'completed'"
    class="icon-[lucide--circle-check] size-4 shrink-0 text-jade-600"
    :aria-label="$t('workflowExecution.completed')"
  />
  <i
    v-else-if="state === 'error'"
    class="icon-[lucide--circle-alert] size-4 shrink-0 text-coral-600"
    :aria-label="$t('workflowExecution.error')"
  />
</template>

<script setup lang="ts">
import type { WorkflowExecutionState } from '@/stores/executionStore'

const { state } = defineProps<{
  state: WorkflowExecutionState
}>()
</script>
