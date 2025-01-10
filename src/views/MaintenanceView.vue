<template>
  <div
    class="font-sans w-screen h-screen text-neutral-300 bg-neutral-900 dark-theme pointer-events-auto overflow-y-auto"
  >
    <div class="max-w-screen-sm w-screen p-8 relative mx-auto">
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
          :loading="isRefreshing"
        />
        <Button
          label="Continue"
          icon="pi pi-arrow-right"
          icon-pos="left"
          :severity="anyErrors ? 'secondary' : 'primary'"
          @click="completeValidation"
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
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { electronAPI, isElectron } from '@/utils/envUtil'
import { computed, onMounted, onUnmounted, Ref, ref } from 'vue'
import { st, t } from '@/i18n'
import RefreshButton from '@/components/common/RefreshButton.vue'
import { PrimeIcons } from '@primevue/core/api'
import { InstallValidation } from '@comfyorg/comfyui-electron-types'
import StatusTag from '@/components/maintenance/StatusTag.vue'
import { minDurationRef } from '@/utils/refUtil'
import { MaintenanceFilter, MaintenanceTask } from '@/types/maintenanceTypes'
import TaskListPanel from '@/components/maintenance/TaskListPanel.vue'
import BaseTerminal from '@/components/bottomPanel/tabs/terminal/BaseTerminal.vue'
import type { useTerminal } from '@/hooks/bottomPanelTabs/useTerminal'
import Drawer from 'primevue/drawer'

/** Refresh should run for at least this long, even if it completes much faster. Ensures refresh feels like it is doing something. */
const minRefreshTime = 250
const electron = electronAPI()
const terminalVisible = ref(false)

/** True when waiting on tasks to complete. */
const isRefreshing = minDurationRef(true, minRefreshTime)

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
  // TODO: if (update.state === 'installed')
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

/** Cherry-picked properties for {@link createTask} function. */
type TaskProps = Pick<
  MaintenanceTask,
  'id' | 'headerImg' | 'onClick' | 'requireConfirm' | 'severity'
> & {
  /** Icon to show on the button, e.g. `'pi pi-external-link'` */
  buttonIcon?: string
}

/**
 * Helper function that creates a maintenance task to display.
 * @param properties Task properties that are not stored in i18n files
 */
function createTask({
  id,
  headerImg,
  severity,
  requireConfirm,
  buttonIcon,
  onClick
}: TaskProps): MaintenanceTask {
  return {
    id,
    name: t(`maintenance.tasks.${id}.name`),
    state: null,
    description: st(`maintenance.tasks.${id}.description`, undefined),
    descriptionOk: st(`maintenance.tasks.${id}.descriptionOk`, undefined),
    errorDescription: st(`maintenance.tasks.${id}.errorDescription`, undefined),
    headerImg,
    severity,
    requireConfirm,
    onClick,
    loading: minDurationRef(true, minRefreshTime),
    button: {
      text: t(`maintenance.tasks.${id}.buttonText`),
      icon: buttonIcon
    }
  }
}

const installRequirements = async () => {
  terminalVisible.value = true
  await electron.uv.installRequirements()
  await completeValidation(false)
  if (tasks.value.find((x) => x.id === 'pythonPackages')?.state === 'OK') {
    terminalVisible.value = false
  }
}

const resetVenv = async () => {
  terminalVisible.value = true
  const success = await electron.uv.resetVenv()
  if (!success) return

  terminalVisible.value = false
  await completeValidation(false)
}

const clearCache = async () => {
  terminalVisible.value = true
  const success = await electron.uv.clearCache()
  if (!success) return

  terminalVisible.value = false
  await completeValidation(false)
  const task = tasks.value.find((x) => x.id === 'uvCache')
  if (task) task.state = 'OK'
}

const electronTasks: MaintenanceTask[] = [
  createTask({
    id: 'basePath',
    onClick: async () => {
      await electron.setBasePath()
      completeValidation()
    },
    buttonIcon: PrimeIcons.QUESTION
  }),
  createTask({
    id: 'git',
    headerImg: '/assets/images/Git-Logo-White.svg',
    onClick: () => window.open('https://git-scm.com/downloads/', '_blank'),
    buttonIcon: PrimeIcons.EXTERNAL_LINK
  }),
  createTask({
    id: 'vcRedist',
    onClick: () =>
      window.open('https://aka.ms/vs/17/release/vc_redist.x64.exe', '_blank'),
    buttonIcon: PrimeIcons.EXTERNAL_LINK
  }),
  createTask({
    id: 'pythonInterpreter',
    requireConfirm: true,
    onClick: () => {},
    buttonIcon: PrimeIcons.SPINNER
  }),
  createTask({
    id: 'pythonPackages',
    requireConfirm: true,
    onClick: installRequirements,
    buttonIcon: PrimeIcons.DOWNLOAD
  }),
  createTask({
    id: 'uv',
    requireConfirm: true,
    onClick: () => {},
    buttonIcon: 'pi pi-asterisk'
  }),
  createTask({
    id: 'uvCache',
    severity: 'danger',
    requireConfirm: true,
    onClick: clearCache,
    buttonIcon: PrimeIcons.TRASH
  }),
  createTask({
    id: 'venvDirectory',
    severity: 'danger',
    requireConfirm: true,
    onClick: resetVenv,
    buttonIcon: PrimeIcons.FOLDER
  })
]

const tasks = ref(isElectron() ? [...electronTasks] : [])

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
  await electron.Validation.installation(processUpdate)
  isRefreshing.value = false
}

const completeValidation = async (alertOnFail = true) => {
  isRefreshing.value = true
  const isValid = await electron.Validation.complete()
  if (alertOnFail && !isValid) {
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
  useAutoSize(root, true, true)
  electron.onLogMessage((message: string) => {
    terminal.write(message)
  })

  terminal.options.cursorBlink = false
  terminal.options.disableStdin = true
  terminal.options.cursorInactiveStyle = 'block'
}

const toggleConsoleDrawer = () => {
  terminalVisible.value = !terminalVisible.value
}

onMounted(async () => {
  electron.Validation.onUpdate(processUpdate)

  const update = await electron.Validation.getStatus()
  processUpdate(update)

  // TODO: Run on load when loading manually
  // refresh()
})

onUnmounted(() => electron.Validation.dispose())
</script>

<style lang="postcss">
:root {
  --p-tag-gap: 0.375rem;
  --p-card-background: var(--p-button-secondary-background);
  --p-card-background: var(--p-button-secondary-background);
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
