<template>
  <div class="flex min-w-0 flex-1 flex-col items-start">
    <div class="my-4 text-lg font-medium">
      {{ t('toastMessages.migrateToLitegraphReroute') }}
    </div>
    <Button class="self-end" size="sm" @click="migrateToLitegraphReroute">
      {{ t('g.migrate') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useToast } from '@/components/ui/toast'
import type { ToastId } from '@/components/ui/toast'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { WorkflowJSON04 } from '@/platform/workflow/validation/schemas/workflowSchema'
import { app } from '@/scripts/app'
import { migrateLegacyRerouteNodes } from '@/utils/migration/migrateReroute'

const { toastId } = defineProps<{ toastId: ToastId }>()
const { t } = useI18n()
const toast = useToast()

const workflowStore = useWorkflowStore()
const migrateToLitegraphReroute = async () => {
  const workflowJSON = app.rootGraph.serialize() as unknown as WorkflowJSON04
  const migratedWorkflowJSON = migrateLegacyRerouteNodes(workflowJSON)
  await app.loadGraphData(
    migratedWorkflowJSON,
    false,
    false,
    workflowStore.activeWorkflow
  )
  toast.dismiss(toastId)
}
</script>
