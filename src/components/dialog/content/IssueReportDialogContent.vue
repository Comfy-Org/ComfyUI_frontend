<template>
  <div class="p-2 h-full" aria-labelledby="issue-report-title">
    <Panel
      :pt="{
        root: 'border-none',
        content: 'p-0'
      }"
    >
      <template #header>
        <header class="flex flex-col items-center w-full">
          <h2 id="issue-report-title" class="text-4xl">
            {{ title }}
          </h2>
          <span v-if="subtitle" class="text-muted mt-0">{{ subtitle }}</span>
        </header>
      </template>
      <ReportIssuePanel v-bind="panelProps" :pt="{ root: 'border-none' }" />
    </Panel>
  </div>
</template>

<script setup lang="ts">
import Panel from 'primevue/panel'

import ReportIssuePanel from '@/components/dialog/content/error/ReportIssuePanel.vue'
import type { IssueReportPanelProps } from '@/types/issueReportTypes'

defineProps<{
  title: string
  subtitle?: string
  panelProps: IssueReportPanelProps
}>()
</script>
