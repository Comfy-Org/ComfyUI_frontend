<template>
  <div
    class="flex w-full items-center justify-between px-6 py-2 shadow-lg"
    :class="{
      'rounded-t-none': progressDialogContent.isExpanded,
      'rounded-lg': !progressDialogContent.isExpanded
    }"
  >
    <div class="flex items-center text-base leading-none">
      <div class="flex items-center">
        <template v-if="isInProgress">
          <DotSpinner duration="1s" class="mr-2" />
          <span>{{ currentTaskName }}</span>
        </template>
        <template v-else-if="isRestartCompleted">
          <span class="mr-2">🎉</span>
          <span>{{ currentTaskName }}</span>
        </template>
        <template v-else>
          <span class="mr-2">✅</span>
          <span>{{ $t('manager.restartToApplyChanges') }}</span>
        </template>
      </div>
    </div>
    <div class="flex items-center gap-4">
      <span v-if="isInProgress" class="text-sm text-neutral-700">
        {{ completedTasksCount }} {{ $t('g.progressCountOf') }}
        {{ totalTasksCount }}
      </span>
      <div class="flex items-center">
        <Button
          v-if="!isInProgress && !isRestartCompleted"
          rounded
          outlined
          class="!dark-theme:bg-transparent mr-4 rounded-md border-2 border-neutral-900 px-3 text-neutral-600 hover:bg-neutral-100 dark-theme:border-white dark-theme:text-white dark-theme:hover:bg-neutral-800"
          @click="handleRestart"
        >
          {{ $t('manager.applyChanges') }}
        </Button>
        <Button
          v-else-if="!isRestartCompleted"
          :icon="
            progressDialogContent.isExpanded
              ? 'pi pi-chevron-up'
              : 'pi pi-chevron-down'
          "
          text
          rounded
          size="small"
          class="font-bold"
          severity="secondary"
          :aria-label="progressDialogContent.isExpanded ? 'Collapse' : 'Expand'"
          @click.stop="progressDialogContent.toggle"
        />
        <Button
          icon="pi pi-times"
          text
          rounded
          size="small"
          class="font-bold"
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
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import DotSpinner from '@/components/common/DotSpinner.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { api } from '@/scripts/api'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useConflictDetection } from '@/workbench/extensions/manager/composables/useConflictDetection'
import { useComfyManagerService } from '@/workbench/extensions/manager/services/comfyManagerService'
import {
  useComfyManagerStore,
  useManagerProgressDialogStore
} from '@/workbench/extensions/manager/stores/comfyManagerStore'

const { t } = useI18n()
const dialogStore = useDialogStore()
const progressDialogContent = useManagerProgressDialogStore()
const comfyManagerStore = useComfyManagerStore()
const settingStore = useSettingStore()
const { runFullConflictAnalysis } = useConflictDetection()

// State management for restart process
const isRestarting = ref<boolean>(false)
const isRestartCompleted = ref<boolean>(false)

const isInProgress = computed(
  () => comfyManagerStore.isProcessingTasks || isRestarting.value
)

const completedTasksCount = computed(() => {
  return (
    comfyManagerStore.succeededTasksIds.length +
    comfyManagerStore.failedTasksIds.length
  )
})

const totalTasksCount = computed(() => {
  const completedTasks = Object.keys(comfyManagerStore.taskHistory).length
  const taskQueue = comfyManagerStore.taskQueue
  const queuedTasks = taskQueue
    ? (taskQueue.running_queue?.length || 0) +
      (taskQueue.pending_queue?.length || 0)
    : 0
  return completedTasks + queuedTasks
})

const closeDialog = () => {
  dialogStore.closeDialog({ key: 'global-manager-progress-dialog' })
}

const fallbackTaskName = t('manager.installingDependencies')
const currentTaskName = computed(() => {
  if (isRestarting.value) {
    return t('manager.restartingBackend')
  }
  if (isRestartCompleted.value) {
    return t('manager.extensionsSuccessfullyInstalled')
  }
  if (!comfyManagerStore.taskLogs.length) return fallbackTaskName
  const task = comfyManagerStore.taskLogs.at(-1)
  return task?.taskName ?? fallbackTaskName
})

const handleRestart = async () => {
  // Store original toast setting value
  const originalToastSetting = settingStore.get(
    'Comfy.Toast.DisableReconnectingToast'
  )

  try {
    await settingStore.set('Comfy.Toast.DisableReconnectingToast', true)

    isRestarting.value = true

    const onReconnect = async () => {
      try {
        comfyManagerStore.setStale()

        await useCommandStore().execute('Comfy.RefreshNodeDefinitions')

        await useWorkflowService().reloadCurrentWorkflow()

        // Run conflict detection in background after restart completion
        void runFullConflictAnalysis()
      } finally {
        await settingStore.set(
          'Comfy.Toast.DisableReconnectingToast',
          originalToastSetting
        )

        isRestarting.value = false
        isRestartCompleted.value = true

        setTimeout(() => {
          closeDialog()
          comfyManagerStore.resetTaskState()
        }, 3000)
      }
    }

    useEventListener(api, 'reconnected', onReconnect, { once: true })

    await useComfyManagerService().rebootComfyUI()
  } catch (error) {
    // If restart fails, restore settings and reset state
    await settingStore.set(
      'Comfy.Toast.DisableReconnectingToast',
      originalToastSetting
    )
    isRestarting.value = false
    isRestartCompleted.value = false
    closeDialog() // Close dialog on error
    throw error
  }
}
</script>
