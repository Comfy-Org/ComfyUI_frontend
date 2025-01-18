<template>
  <div class="p-8 h-full">
    <Card>
      <template #header>
        <header class="flex flex-col items-center p-4 pb-0">
          <h2 class="text-4xl">{{ props.title }}</h2>
          <span class="text-muted pb-4">{{ props.subtitle }}</span>
        </header>
      </template>
      <template #content>
        <div>
          <ReportIssuePanel v-bind="props.panelProps" />
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import Card from 'primevue/card'

import type { IssueReportPanelProps } from '@/types/issueReportTypes'

import ReportIssuePanel from './error/ReportIssuePanel.vue'

const props = defineProps<{
  title: string
  subtitle?: string
  panelProps: IssueReportPanelProps
}>()
</script>
