<template>
  <div
    class="w-full px-6 py-2 shadow-lg flex items-center justify-between"
    :class="{
      'rounded-t-none': progressDialogContent.isExpanded,
      'rounded-lg': !progressDialogContent.isExpanded
    }"
  >
    <div class="flex items-center text-base leading-none">
      <div class="flex items-center">
        <!-- 1. Queue running (install/enable/disable etc.) -->
        <template v-if="isQueueRunning">
          <DotSpinner duration="1s" class="mr-2" />
          <span>{{ currentTaskName }}</span>
        </template>
        <!-- 3. Restarting -->
        <template v-else-if="isRestarting">
          <DotSpinner duration="1s" class="mr-2" />
          <span>{{ $t('manager.restartingBackend') }}</span>
        </template>
        <!-- 4. Restart completed -->
        <template v-else-if="isRestartCompleted">
          <span class="mr-2">🎉</span>
          <span>{{ $t('manager.extensionsSuccessfullyInstalled') }}</span>
        </template>
        <!-- 2. Tasks completed (waiting for restart) -->
        <template v-else>
          <span class="mr-2">✅</span>
          <span>
            {{ $t('manager.clickToFinishSetup') }}
            '{{ $t('manager.applyChanges') }}'
            {{ $t('manager.toFinishSetup') }}
          </span>
        </template>
      </div>
    </div>

    <div class="flex items-center gap-4">
      <!-- 1. Queue running -->
      <template v-if="isQueueRunning">
        <span class="text-sm text-neutral-700 dark-theme:text-neutral-400">
          {{ completedTasksCount }} {{ $t('g.progressCountOf') }}
          {{ taskLogs }}
        </span>
        <Button
          :icon="
            progressDialogContent.isExpanded
              ? 'pi pi-chevron-up'
              : 'pi pi-chevron-right'
          "
          text
          rounded
          size="small"
          class="font-bold"
          severity="secondary"
          :aria-label="progressDialogContent.isExpanded ? 'Collapse' : 'Expand'"
          @click.stop="progressDialogContent.toggle"
        />
      </template>

      <!-- 2. Tasks completed (waiting for restart) -->
      <template v-else-if="!isRestarting && !isRestartCompleted">
        <Button
          rounded
          outlined
          class="rounded-md border-2 px-3 text-neutral-600 border-neutral-900 hover:bg-neutral-100 dark-theme:bg-none dark-theme:text-white dark-theme:border-white dark-theme:hover:bg-neutral-700"
          @click="handleRestart"
        >
          {{ $t('manager.applyChanges') }}
        </Button>
      </template>

      <!-- 3. Restarting -->
      <template v-else-if="isRestarting">
        <!-- No buttons during restart -->
      </template>

      <!-- 4. Restart completed -->
      <template v-else-if="isRestartCompleted">
        <!-- No buttons after restart completed (auto-close after 3 seconds) -->
      </template>

      <!-- Common: Close button -->
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
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import DotSpinner from '@/components/common/DotSpinner.vue'
import { api } from '@/scripts/api'
import { useComfyManagerService } from '@/services/comfyManagerService'
import { useWorkflowService } from '@/services/workflowService'
import {
  useComfyManagerStore,
  useManagerProgressDialogStore
} from '@/stores/comfyManagerStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useSettingStore } from '@/stores/settingStore'

const { t } = useI18n()
const dialogStore = useDialogStore()
const progressDialogContent = useManagerProgressDialogStore()
const comfyManagerStore = useComfyManagerStore()
const settingStore = useSettingStore()

// State management for restart process
const isRestarting = ref<boolean>(false)
const isRestartCompleted = ref<boolean>(false)

// Computed states
const isQueueRunning = computed(() => comfyManagerStore.uncompletedCount > 0)
const taskLogs = computed(() => comfyManagerStore.taskLogs.length)

const completedTasksCount = computed(() => {
  if (isQueueRunning.value && taskLogs.value > 0) {
    return taskLogs.value - 1
  }
  return taskLogs.value
})

const closeDialog = () => {
  dialogStore.closeDialog({ key: 'global-manager-progress-dialog' })
}

const fallbackTaskName = t('manager.installingDependencies')
const currentTaskName = computed(() => {
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
      } finally {
        await settingStore.set(
          'Comfy.Toast.DisableReconnectingToast',
          originalToastSetting
        )

        isRestarting.value = false
        isRestartCompleted.value = true

        setTimeout(() => {
          closeDialog()
          comfyManagerStore.clearLogs()
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
