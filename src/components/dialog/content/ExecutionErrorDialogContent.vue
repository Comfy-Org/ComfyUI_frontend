<template>
  <NoResultsPlaceholder
    icon="pi pi-exclamation-circle"
    :title="error.node_type"
    :message="error.exception_message"
  />
  <ErrorReport :error="error" />
</template>

<script setup lang="ts">
import { ExecutionErrorWsMessage } from '@/types/apiTypes'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import ErrorReport from './error/ErrorReport.vue'

const props = defineProps<{
  error: ExecutionErrorWsMessage
}>()

const error = props.error
</script>

<style scoped>
.no-results-placeholder {
  padding-top: 0;
}
</style>
