<template>
  <BaseViewTemplate dark>
    <div
      class="min-w-full min-h-full font-sans w-screen h-screen grid justify-around text-neutral-300 bg-neutral-900 dark-theme pointer-events-auto overflow-y-auto"
    >
      <div class="max-w-screen-sm w-screen m-8 relative">
        <!-- Header -->
        <h1 class="backspan pi-wrench text-4xl font-bold">Maintenance</h1>

        <!-- Toolbar -->
        <div class="w-full flex flex-wrap gap-4 items-center">
          <span class="grow">
            Status: <StatusTag :refreshing="isRefreshing" :error="anyErrors" />
          </span>
          <div class="flex gap-4 items-center">
            <SelectButton
              v-model="displayAsList"
              :options="[PrimeIcons.LIST, PrimeIcons.TH_LARGE]"
              :allow-empty="false"
            >
              <template #option="opts"><i :class="opts.option" /></template>
            </SelectButton>
            <SelectButton
              v-model="filter"
              :options="filterOptions"
              :allow-empty="false"
              optionLabel="value"
              dataKey="value"
              area-labelledby="custom"
              @change="clearResolved"
            >
              <template #option="opts">
                <i :class="opts.option.icon"></i>
                <span class="max-sm:hidden">{{ opts.option.value }}</span>
              </template>
            </SelectButton>
            <RefreshButton
              v-model="isRefreshing"
              severity="secondary"
              @refresh="refresh"
            />
          </div>
        </div>

        <!-- Tasks -->
        <TaskListPanel
          class="border-neutral-700 border-solid border-x-0 border-y"
          :filter
          :displayAsList
          :isRefreshing
        />

        <!-- Actions -->
        <div class="flex justify-between gap-4 flex-row">
          <Button
            label="Console Logs"
            icon="pi pi-desktop"
            icon-pos="left"
            severity="secondary"
            @click="toggleConsoleDrawer"
          />
          <Button
            label="Continue"
            icon="pi pi-arrow-right"
            icon-pos="left"
            :severity="anyErrors ? 'secondary' : 'primary'"
            @click="() => completeValidation()"
            :loading="isRefreshing"
          />
        </div>
      </div>

      <Drawer
        v-model:visible="terminalVisible"
        header="Terminal"
        position="bottom"
        style="height: max(50vh, 34rem)"
      >
        <BaseTerminal @created="terminalCreated" />
      </Drawer>
      <Toast />
    </div>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import { InstallValidation } from '@comfyorg/comfyui-electron-types'
import { PrimeIcons } from '@primevue/core/api'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import SelectButton from 'primevue/selectbutton'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { Ref, computed, onMounted, onUnmounted, ref } from 'vue'

import BaseTerminal from '@/components/bottomPanel/tabs/terminal/BaseTerminal.vue'
import RefreshButton from '@/components/common/RefreshButton.vue'
import StatusTag from '@/components/maintenance/StatusTag.vue'
import TaskListPanel from '@/components/maintenance/TaskListPanel.vue'
import { useMaintenanceTasks } from '@/extensions/core/electronTasks'
import type { useTerminal } from '@/hooks/bottomPanelTabs/useTerminal'
import {
  MaintenanceFilter,
  MaintenanceTask
} from '@/types/desktop/maintenanceTypes'
import { electronAPI, isElectron } from '@/utils/envUtil'
import { useMinLoadingDurationRef } from '@/utils/refUtil'

import BaseViewTemplate from './templates/BaseViewTemplate.vue'

/** Refresh should run for at least this long, even if it completes much faster. Ensures refresh feels like it is doing something. */
const minRefreshTime = 250
const electron = electronAPI()
const toast = useToast()

const terminalVisible = ref(false)

/** `true` when waiting on tasks to complete. */
const isRefreshing = useMinLoadingDurationRef(true, minRefreshTime)

/** True if any tasks are in an error state. */
const anyErrors = computed(() => tasks.value.some((x) => x.state === 'error'))

/** Whether to display tasks as a list or cards. */
const displayAsList = ref(PrimeIcons.TH_LARGE)

/** The most recent validation state update. */
const validationState = ref<InstallValidation>({
  inProgress: false,
  installState: 'started'
})

/**
 * Updates the task list with the latest validation state.
 * @param update Update details passed in by electron
 */
const processUpdate = (update: InstallValidation) => {
  validationState.value = update

  // Update each task state
  for (const task of tasks.value) {
    task.loading = update[task.id] === undefined
    // Mark resolved
    if (task.state === 'error' && update[task.id] === 'OK') task.resolved = true
    if (update[task.id]) task.state = update[task.id]
  }

  // Final update
  if (!update.inProgress && isRefreshing.value) {
    isRefreshing.value = false
    for (const task of tasks.value) {
      task.state = update[task.id] ?? 'skipped'
      task.loading = false
    }
  }
}

const tasks = ref(isElectron() ? useMaintenanceTasks() : [])

const errorFilter = computed(() =>
  tasks.value.filter(
    (x) => x.state === 'error' || (x.state === 'OK' && x.resolved)
  )
)
const filterOptions = ref([
  { icon: PrimeIcons.FILTER_FILL, value: 'All', tasks },
  { icon: PrimeIcons.EXCLAMATION_TRIANGLE, value: 'Errors', tasks: errorFilter }
])

/** Filter binding; can be set to show all tasks, or only errors. */
const filter = ref<MaintenanceFilter>(filterOptions.value[1])

/** @todo Refreshes Electron tasks only. */
const refresh = async () => {
  isRefreshing.value = true
  await electron.Validation.validateInstallation(processUpdate)
  isRefreshing.value = false
}

const completeValidation = async (alertOnFail = true) => {
  isRefreshing.value = true
  const isValid = await electron.Validation.complete()
  if (alertOnFail && !isValid) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Unable to continue - errors remain',
      life: 5_000
    })
    isRefreshing.value = false
  }
}

/** Clears the resolved status of tasks (when changing filters) */
const clearResolved = () => {
  for (const task of tasks.value) task.resolved &&= false
}

const terminalCreated = (
  { terminal, useAutoSize }: ReturnType<typeof useTerminal>,
  root: Ref<HTMLElement>
) => {
  useAutoSize({ root, autoRows: true, autoCols: true })
  electron.onLogMessage((message: string) => {
    terminal.write(message)
  })

  terminal.options.cursorBlink = false
  terminal.options.cursorStyle = 'bar'
  terminal.options.cursorInactiveStyle = 'bar'
  terminal.options.disableStdin = true
}

const toggleConsoleDrawer = () => {
  terminalVisible.value = !terminalVisible.value
}

const wrapTaskExecution = (task: MaintenanceTask) => async () => {
  if (task.usesTerminal) terminalVisible.value = true
  try {
    const success = await task.execute()
    if (!success) throw new Error('Task failed to run.')
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Task error',
      detail:
        error.message ?? 'An error occurred while running a maintenance task.',
      life: 10_000
    })
  }

  if (task.usesTerminal) terminalVisible.value = false
  if (task.isInstallationFix) await completeValidation(false)
}

onMounted(async () => {
  // Wrap task execution to show / hide terminal and complete validation if applicable
  for (const task of tasks.value) {
    task.onClick = wrapTaskExecution(task)
  }

  electron.Validation.onUpdate(processUpdate)

  const update = await electron.Validation.getStatus()
  processUpdate(update)
})

onUnmounted(() => electron.Validation.dispose())
</script>

<style scoped>
:deep(.p-tag) {
  --p-tag-gap: 0.375rem;
}

.backspan::before {
  @apply m-0 absolute text-muted;
  font-family: 'primeicons';
  top: -2rem;
  right: -2rem;
  speak: none;
  font-style: normal;
  font-weight: normal;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  display: inline-block;
  -webkit-font-smoothing: antialiased;
  opacity: 0.02;
  font-size: min(14rem, 90vw);
  z-index: 0;
}
</style>
