<template>
  <div class="w-full">
    <div
      v-if="loading"
      class="flex aspect-video w-full items-center justify-center rounded-md bg-dialog-surface"
    >
      <i
        class="icon-[lucide--loader-circle] size-6 animate-spin text-muted-foreground"
      />
    </div>
    <img
      v-else-if="thumbnailUrl"
      :src="thumbnailUrl"
      class="aspect-video w-full rounded-md bg-dialog-surface object-contain"
    />
    <div
      v-else
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

import { renderWorkflowJsonThumbnail } from '@/renderer/core/thumbnail/workflowJsonThumbnailRenderer'
import type { WorkflowJsonInput } from '@/renderer/extensions/minimap/data/WorkflowJsonDataSource'

const { workflowJson = null, loading = false } = defineProps<{
  workflowJson?: WorkflowJsonInput | null
  loading?: boolean
}>()

const thumbnailUrl = computed(() => {
  if (!workflowJson) return null
  return renderWorkflowJsonThumbnail(workflowJson, 500, 280)
})
</script>
