<template>
  <div class="p-8 h-full min-w-96">
    <div class="flex flex-col items-center">
      <h3 class="text-4xl">{{ $t('g.feedback') }}</h3>
    </div>
  </div>
  <Divider />
  <div>
    <ReportIssuePanel
      error-type="Feedback"
      :title="$t('issueReport.feedbackTitle')"
      :default-fields="['SystemStats', 'Settings']"
    />
  </div>
</template>

<script setup lang="ts">
import Divider from 'primevue/divider'

import ReportIssuePanel from '@/components/dialog/content/error/ReportIssuePanel.vue'
</script>

<style scoped>
:deep(.p-panel) {
  @apply border-none;
}
</style>
