<template>
  <div
    class="w-full px-6 py-4 shadow-lg flex items-center justify-between"
    :class="{
      'rounded-t-none': progressDialogContent.isExpanded,
      'rounded-lg': !progressDialogContent.isExpanded
    }"
  >
    <div class="justify-center text-sm font-bold leading-none">
      <div class="flex items-center">
        <template v-if="isInProgress">
          <i class="pi pi-spin pi-spinner mr-2 text-3xl" />
          <span>{{ currentTaskName }}</span>
        </template>
        <template v-else>
          <i class="pi pi-check-circle mr-2 text-green-500" />
          <span class="leading-none">{{
            $t('manager.restartToApplyChanges')
          }}</span>
        </template>
      </div>
    </div>
    <div class="flex items-center gap-4">
      <span v-if="isInProgress" class="text-xs font-bold text-neutral-600">
        {{ comfyManagerStore.uncompletedCount }} of
        {{ comfyManagerStore.taskLogs.length }}
      </span>
      <div class="flex items-center">
        <Button
          v-if="!isInProgress"
          rounded
          outlined
          class="px-4 py-2 rounded-md mr-4"
          @click="handleRestart"
        >
          {{ $t('g.restart') }}
        </Button>
        <Button
          :icon="
            progressDialogContent.isExpanded
              ? 'pi pi-chevron-up'
              : 'pi pi-chevron-right'
          "
          text
          rounded
          size="small"
          severity="secondary"
          :aria-label="progressDialogContent.isExpanded ? 'Collapse' : 'Expand'"
          @click.stop="progressDialogContent.toggle"
        />
        <Button
          icon="pi pi-times"
          text
          rounded
          size="small"
          severity="secondary"
          aria-label="Close"
          @click.stop="closeDialog"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/scripts/api'
import { useComfyManagerService } from '@/services/comfyManagerService'
import { useWorkflowService } from '@/services/workflowService'
import {
  useComfyManagerStore,
  useManagerProgressDialogStore
} from '@/stores/comfyManagerStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'

const { t } = useI18n()
const dialogStore = useDialogStore()
const progressDialogContent = useManagerProgressDialogStore()
const comfyManagerStore = useComfyManagerStore()

const isInProgress = computed(() => comfyManagerStore.uncompletedCount > 0)

const closeDialog = () => {
  dialogStore.closeDialog({ key: 'global-manager-progress-dialog' })
}

const fallbackTaskName = t('g.installing')
const currentTaskName = computed(() => {
  if (!comfyManagerStore.taskLogs.length) return fallbackTaskName
  const task = comfyManagerStore.taskLogs.at(-1)
  return task?.taskName ?? fallbackTaskName
})

const handleRestart = async () => {
  const onReconnect = async () => {
    // Refresh manager state

    comfyManagerStore.clearLogs()
    comfyManagerStore.setStale()

    // Refresh node definitions
    await useCommandStore().execute('Comfy.RefreshNodeDefinitions')

    // Reload workflow
    await useWorkflowService().reloadCurrentWorkflow()
  }
  useEventListener(api, 'reconnected', onReconnect, { once: true })

  await useComfyManagerService().rebootComfyUI()
  closeDialog()
}
</script>
