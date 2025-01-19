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
import type { useTerminal } from '@/hooks/bottomPanelTabs/useTerminal'
import { st, t } from '@/i18n'
import {
  MaintenanceFilter,
  MaintenanceTask
} from '@/types/desktop/maintenanceTypes'
import { electronAPI, isElectron } from '@/utils/envUtil'
import { minDurationRef } from '@/utils/refUtil'

import BaseViewTemplate from './templates/BaseViewTemplate.vue'

/** Refresh should run for at least this long, even if it completes much faster. Ensures refresh feels like it is doing something. */
const minRefreshTime = 250
const electron = electronAPI()
const terminalVisible = ref(false)
const toast = useToast()

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
    detail: st(`maintenance.tasks.${id}.detail`, undefined),
    confirmText: st(`maintenance.tasks.${id}.confirmText`, undefined),
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
  try {
    await electron.uv.installRequirements()
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Failed to install requirements',
      detail: error.message,
      life: 10_000
    })
  }
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

const openUrl = (url: string) => window.open(url, '_blank')

const electronTasks: MaintenanceTask[] = [
  {
    id: 'basePath',
    state: null,
    onClick: async () => {
      await electron.setBasePath()
      completeValidation(false)
    },
    name: 'Base path',
    description: 'Change the application base path.',
    errorDescription: 'Unable to open the base path.  Please select a new one.',
    detail:
      'The base path is the default location where ComfyUI stores data. It is the location fo the python environment, and may also contain models, custom nodes, and other extensions.',
    loading: minDurationRef(true, minRefreshTime),
    button: {
      icon: PrimeIcons.QUESTION,
      text: 'Select'
    }
  },
  {
    id: 'git',
    state: null,
    headerImg: '/assets/images/Git-Logo-White.svg',
    onClick: () => openUrl('https://git-scm.com/downloads/'),
    name: 'Download git',
    description: 'Open the git download page.',
    detail:
      'Git is required to download and manage custom nodes and other extensions. This fixer simply opens the download page in your browser. You must download and install git manually.',
    loading: minDurationRef(true, minRefreshTime),
    button: {
      icon: PrimeIcons.EXTERNAL_LINK,
      text: 'Download'
    }
  },
  {
    id: 'vcRedist',
    state: null,
    onClick: () => openUrl('https://aka.ms/vs/17/release/vc_redist.x64.exe'),
    name: 'Download VC++ Redist',
    description: 'Download the latest VC++ Redistributable runtime.',
    detail:
      'The Visual C++ runtime libraries are required to run ComfyUI. You will need to download and install this file.',
    loading: minDurationRef(true, minRefreshTime),
    button: {
      icon: PrimeIcons.EXTERNAL_LINK,
      text: 'Download'
    }
  },
  {
    id: 'reinstall',
    state: null,
    severity: 'danger',
    requireConfirm: true,
    onClick: () => electron.reinstall(),
    name: 'Reinstall ComfyUI',
    description: 'Deletes the desktop app config and load the welcome screen.',
    detail:
      'Delete the desktop app config, restart the app, and load the installation screen.',
    confirmText: 'Delete all saved config and reinstall?',
    loading: minDurationRef(true, minRefreshTime),
    button: {
      icon: PrimeIcons.EXCLAMATION_TRIANGLE,
      text: 'Reinstall'
    }
  },
  {
    id: 'pythonPackages',
    state: null,
    requireConfirm: true,
    onClick: installRequirements,
    name: 'Install python packages',
    description: 'Installs the base python packages required to run ComfyUI.',
    errorDescription:
      'Python packages that are required to run ComfyUI are not installed.',
    detail:
      'This will install the python packages required to run ComfyUI. This includes torch, torchvision, and other dependencies.',
    loading: minDurationRef(true, minRefreshTime),
    button: {
      icon: PrimeIcons.DOWNLOAD,
      text: 'Install'
    }
  },
  {
    id: 'uv',
    state: null,
    onClick: () =>
      openUrl('https://docs.astral.sh/uv/getting-started/installation/'),
    name: 'uv executable',
    description: 'uv installs and maintains the python environment.',
    detail:
      "This will open the download page for Astral's uv tool. uv is used to install python and manage python packages.",
    loading: minDurationRef(true, minRefreshTime),
    button: {
      icon: 'pi pi-asterisk',
      text: 'Download'
    }
  },
  {
    id: 'uvCache',
    state: null,
    severity: 'danger',
    requireConfirm: true,
    onClick: clearCache,
    name: 'uv cache',
    description: 'Remove the Astral uv cache of python packages.',
    detail:
      'This will remove the uv cache directory and its contents. All downloaded python packages will need to be downloaded again.',
    confirmText: 'Delete uv cache of python packages?',
    loading: minDurationRef(true, minRefreshTime),
    button: {
      icon: PrimeIcons.TRASH,
      text: 'Clear cache'
    }
  },
  {
    id: 'venvDirectory',
    state: null,
    severity: 'danger',
    requireConfirm: true,
    onClick: resetVenv,
    name: 'Reset virtual environment',
    description:
      'Remove and recreate the .venv directory. This removes all python packages.',
    detail:
      'The python environment is where ComfyUI installs python and python packages. It is used to run the ComfyUI server.',
    confirmText: 'Delete the .venv directory?',
    loading: minDurationRef(true, minRefreshTime),
    button: {
      icon: PrimeIcons.FOLDER,
      text: 'Recreate'
    }
  }
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

onMounted(async () => {
  electron.Validation.onUpdate(processUpdate)

  const update = await electron.Validation.getStatus()
  processUpdate(update)
})

onUnmounted(() => electron.Validation.dispose())
</script>

<style>
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
