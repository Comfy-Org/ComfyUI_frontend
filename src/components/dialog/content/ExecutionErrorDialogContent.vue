<template>
  <NoResultsPlaceholder
    icon="pi pi-exclamation-circle"
    :title="error.node_type"
    :message="error.exception_message"
    :buttonLabel="$t('showReport')"
    @action="openReportDialog"
  />
</template>

<script setup lang="ts">
import { ExecutionErrorWsMessage } from '@/types/apiTypes'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import { useDialogStore } from '@/stores/dialogStore'
import ErrorReportDialogContent from './ErrorReportDialogContent.vue'
import { api } from '@/scripts/api'

const props = defineProps<{
  error: ExecutionErrorWsMessage
}>()

const error = props.error
const dialogStore = useDialogStore()

const openReportDialog = async () => {
  dialogStore.showDialog({
    component: ErrorReportDialogContent,
    props: {
      error: error,
      systemStats: await api.getSystemStats()
    }
  })
}
</script>

<style scoped>
.no-results-placeholder {
  padding-top: 0;
}
</style>
