<template>
  <div class="w-full">
    <div
      v-if="loading"
      role="status"
      :aria-label="t('g.loading')"
      class="flex aspect-video w-full items-center justify-center rounded-md bg-dialog-surface"
    >
      <i
        class="icon-[lucide--loader-circle] size-6 animate-spin text-muted-foreground"
      />
    </div>
    <img
      v-else-if="thumbnailUrl"
      :src="thumbnailUrl"
      :alt="t('templateWorkflows.details.viewGraph')"
      class="aspect-video w-full rounded-md bg-dialog-surface object-contain"
    />
    <div
      v-else
      role="img"
      :aria-label="t('templateWorkflows.details.viewGraph')"
      class="flex aspect-video w-full items-center justify-center gap-2 rounded-md bg-dialog-surface"
    >
      <i
        class="icon-[lucide--workflow] size-6 text-muted-foreground opacity-40"
      />
      <i
        class="icon-[lucide--help-circle] size-6 text-muted-foreground opacity-40"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { renderWorkflowJsonThumbnail } from '@/renderer/core/thumbnail/workflowJsonThumbnailRenderer'
import type { WorkflowJsonInput } from '@/renderer/extensions/minimap/data/WorkflowJsonDataSource'

const { t } = useI18n()

const { workflowJson = null, loading = false } = defineProps<{
  workflowJson?: WorkflowJsonInput | null
  loading?: boolean
}>()

const thumbnailUrl = computed(() => {
  if (!workflowJson) return null
  return renderWorkflowJsonThumbnail(workflowJson, 500, 280)
})
</script>
