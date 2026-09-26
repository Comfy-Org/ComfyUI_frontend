<script setup lang="ts">
import WorkflowTemplateDownloadStatus from '@/components/custom/widget/WorkflowTemplateDownloadStatus.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import type { TemplateDetailRow } from '@/platform/workflow/templates/types/templateDetail'

const { row } = defineProps<{ row: TemplateDetailRow }>()
const emit = defineEmits<{ download: [] }>()
</script>

<template>
  <a
    v-if="row.status?.kind === 'manual'"
    :href="row.status.href"
    target="_blank"
    rel="noopener noreferrer"
    class="shrink-0 text-xs text-base-foreground no-underline hover:underline focus-visible:rounded-sm focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none"
  >
    {{ row.status.label }}
    <span aria-hidden="true">↗</span>
  </a>
  <WorkflowTemplateDownloadStatus
    v-else-if="row.status?.kind === 'downloadable'"
    :status="row.status"
    :row-name="row.name"
    @download="emit('download')"
  />
  <span
    v-else-if="row.status?.kind === 'installed'"
    role="img"
    :aria-label="row.status.label"
    :title="row.status.label"
    class="flex size-6 shrink-0 items-center justify-center"
  >
    <i
      aria-hidden="true"
      class="icon-[lucide--circle-check] size-4 text-success-background"
    />
  </span>
  <span v-else-if="row.status" class="flex shrink-0 items-center gap-2">
    <Badge
      severity="secondary"
      variant="badge"
      class="h-5 px-2 py-0.5 text-xs font-medium text-muted-foreground normal-case"
    >
      {{ row.status.label }}
    </Badge>
  </span>
</template>
