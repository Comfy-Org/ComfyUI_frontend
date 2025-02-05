<template>
  <BaseViewTemplate dark>
    <div
      class="h-screen w-screen grid items-center justify-around overflow-y-auto"
    >
      <div class="relative m-8 text-center">
        <!-- Header -->
        <h1 class="download-bg pi-download text-4xl font-bold">
          {{ t('desktopUpdate.title') }}
        </h1>

        <div class="m-8">
          <span>{{ t('desktopUpdate.description') }}</span>
        </div>

        <ProgressSpinner class="m-8 w-48 h-48" />

        <!-- Console button -->
        <Button
          style="transform: translateX(-50%)"
          class="fixed bottom-0 left-1/2 my-8"
          :label="t('maintenance.consoleLogs')"
          icon="pi pi-desktop"
          icon-pos="left"
          severity="secondary"
          @click="toggleConsoleDrawer"
        />

        <Drawer
          v-model:visible="terminalVisible"
          :header="t('g.terminal')"
          position="bottom"
          style="height: max(50vh, 34rem)"
        >
          <BaseTerminal
            @created="terminalCreated"
            @unmounted="terminalUnmounted"
          />
        </Drawer>
      </div>
    </div>
    <Toast />
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import { PrimeIcons } from '@primevue/core/api'
import { Terminal } from '@xterm/xterm'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import ProgressSpinner from 'primevue/progressspinner'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { Ref, computed, onMounted, onUnmounted, ref } from 'vue'
import { watch } from 'vue'

import BaseTerminal from '@/components/bottomPanel/tabs/terminal/BaseTerminal.vue'
import type { useTerminal } from '@/hooks/bottomPanelTabs/useTerminal'
import { useTerminalBuffer } from '@/hooks/bottomPanelTabs/useTerminalBuffer'
import { t } from '@/i18n'
import { useMaintenanceTaskStore } from '@/stores/maintenanceTaskStore'
import { MaintenanceFilter } from '@/types/desktop/maintenanceTypes'
import { electronAPI } from '@/utils/envUtil'
import { useMinLoadingDurationRef } from '@/utils/refUtil'

import BaseViewTemplate from './templates/BaseViewTemplate.vue'

const electron = electronAPI()
const toast = useToast()
const taskStore = useMaintenanceTaskStore()
const { processUpdate } = taskStore

const terminalVisible = ref(false)

// Use a minimum run time to ensure tasks "feel" like they have run
const reactiveIsRefreshing = computed(() => taskStore.isRefreshing)
/** `true` when waiting on tasks to complete. */
const isRefreshing = useMinLoadingDurationRef(reactiveIsRefreshing, 250)

/** True if any tasks are in an error state. */
const anyErrors = computed(() => taskStore.anyErrors)

/** Whether to display tasks as a list or cards. */
const displayAsList = ref(PrimeIcons.TH_LARGE)

const errorFilter = computed(() =>
  taskStore.tasks.filter((x) => {
    const { state, resolved } = taskStore.getRunner(x)
    return state === 'error' || resolved
  })
)

const filterOptions = ref([
  { icon: PrimeIcons.FILTER_FILL, value: 'All', tasks: taskStore.tasks },
  { icon: PrimeIcons.EXCLAMATION_TRIANGLE, value: 'Errors', tasks: errorFilter }
])

/** Filter binding; can be set to show all tasks, or only errors. */
const filter = ref<MaintenanceFilter>(filterOptions.value[1])

/** The actual output of all terminal commands - not rendered */
const buffer = useTerminalBuffer()
let xterm: Terminal | null = null

/** If valid, leave the validation window. */
const completeValidation = async (alertOnFail = true) => {
  const isValid = await electron.Validation.complete()
  if (alertOnFail && !isValid) {
    toast.add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('maintenance.error.cannotContinue'),
      life: 5_000
    })
  }
}

// Created and destroyed with the Drawer - contents copied from hidden buffer
const terminalCreated = (
  { terminal, useAutoSize }: ReturnType<typeof useTerminal>,
  root: Ref<HTMLElement>
) => {
  xterm = terminal
  useAutoSize({ root, autoRows: true, autoCols: true })
  terminal.write(t('desktopUpdate.terminalDefaultMessage'))
  buffer.copyTo(terminal)

  terminal.options.cursorBlink = false
  terminal.options.cursorStyle = 'bar'
  terminal.options.cursorInactiveStyle = 'bar'
  terminal.options.disableStdin = true
}

const terminalUnmounted = () => {
  xterm = null
}

const toggleConsoleDrawer = () => {
  terminalVisible.value = !terminalVisible.value
}

// Show terminal when in use
watch(
  () => taskStore.isRunningTerminalCommand,
  (value) => {
    terminalVisible.value = value
  }
)

// If we're running a fix that may resolve all issues, auto-recheck and continue if everything is OK
watch(
  () => taskStore.isRunningInstallationFix,
  (value, oldValue) => {
    if (!value && oldValue) completeValidation(false)
  }
)

onMounted(async () => {
  electron.Validation.onUpdate(processUpdate)

  electron.onLogMessage((message: string) => {
    buffer.write(message)
    xterm?.write(message)
  })

  const update = await electron.Validation.getStatus()
  processUpdate(update)
})

onUnmounted(() => electron.Validation.dispose())
</script>

<style scoped>
:deep(.p-tag) {
  --p-tag-gap: 0.375rem;
}

.download-bg::before {
  @apply m-0 absolute text-muted;
  font-family: 'primeicons';
  top: -2rem;
  right: 2rem;
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
