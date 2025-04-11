<template>
  <Toast group="reroute-migration">
    <template #message>
      <div class="flex flex-col items-start flex-auto">
        <div class="font-medium text-lg my-4">
          {{ t('toastMessages.migrateToLitegraphReroute') }}
        </div>
        <Button
          class="self-end"
          size="small"
          :label="t('g.migrate')"
          severity="warn"
          @click="migrateToLitegraphReroute"
        />
      </div>
    </template>
  </Toast>
</template>

<script setup lang="ts">
import { useToast } from 'primevue'
import Button from 'primevue/button'
import Toast from 'primevue/toast'
import { useI18n } from 'vue-i18n'

import type { WorkflowJSON04 } from '@/schemas/comfyWorkflowSchema'
import { app } from '@/scripts/app'
import { useWorkflowStore } from '@/stores/workflowStore'
import { migrateLegacyRerouteNodes } from '@/utils/migration/migrateReroute'

const { t } = useI18n()
const toast = useToast()

const workflowStore = useWorkflowStore()
const migrateToLitegraphReroute = async () => {
  const workflowJSON = app.graph.serialize() as unknown as WorkflowJSON04
  const migratedWorkflowJSON = migrateLegacyRerouteNodes(workflowJSON)
  await app.loadGraphData(
    migratedWorkflowJSON,
    false,
    false,
    workflowStore.activeWorkflow
  )
  toast.removeGroup('reroute-migration')
}
</script>
