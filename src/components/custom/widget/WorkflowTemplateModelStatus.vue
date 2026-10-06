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
    class="col-start-3 row-start-1 shrink-0 text-xs text-base-foreground no-underline hover:underline focus-visible:rounded-sm focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none"
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
    class="col-start-3 row-start-1 flex size-8 shrink-0 items-center justify-center"
  >
    <i
      aria-hidden="true"
      class="icon-[lucide--circle-check] size-4 text-success-background"
    />
  </span>
  <span
    v-else-if="row.status"
    class="col-start-3 row-start-1 flex shrink-0 items-center gap-2"
  >
    <Badge severity="secondary" variant="compact" class="text-muted-foreground">
      {{ row.status.label }}
    </Badge>
  </span>
</template>
