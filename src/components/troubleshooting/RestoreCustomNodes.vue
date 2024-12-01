<template>
  <!-- Never run -->
  <template v-if="!state">
    <a
      class="w-full h-full flex items-center justify-center transition duration-125 ease-in-out bg-opacity-0 hover:bg-opacity-30 bg-black cursor-pointer"
      @click="restoreCustomNodes()"
    >
      <i
        class="pi pi-download text-6xl"
        :class="{ 'text-red-600': commandFailed }"
      ></i>
      <p v-if="commandFailed" class="absolute top-0">Unknown Error</p>
    </a>
  </template>
  <!-- Running -->
  <template v-else-if="state === 'running'">
    <div
      class="relative inset-0 z-1 h-full flex flex-col bg-black bg-opacity-50 items-center justify-between"
    >
      <ProgressSpinner class="absolute inset-0 z-1 w-3/12 h-full" />
      <p v-if="current === 0">
        {{ $t('troubleshooting.restoreCustomNodes.loading') }}
      </p>
      <p v-else>
        {{ $t('troubleshooting.restoreCustomNodes.installing') }}:
        {{ current }} / {{ total }}
      </p>
      <p v-if="failed > 0" class="text-red-600">
        {{ $t('troubleshooting.restoreCustomNodes.failed') }}:
        {{ failed }}
      </p>
    </div>
  </template>
  <!-- Complete -->
  <template v-else-if="state === 'complete'">
    <div class="z-1 h-full flex flex-col items-center justify-center">
      <template v-if="failed > 0">
        <p class="text-red-600 flex-grow">
          {{ $t('troubleshooting.restoreCustomNodes.failed') }}: {{ failed }} /
          {{ total }}
        </p>
        <Button
          class="absolute"
          icon="pi pi-file"
          severity="secondary"
          :label="$t('serverStart.openLogs')"
          @click="openLogs()"
        />
      </template>
      <template v-else>
        <p class="flex-grow">
          {{ $t('troubleshooting.restoreCustomNodes.installed') }}:
          {{ installed }} / {{ total }}
        </p>
        <i class="absolute pi pi-check text-6xl"></i>
      </template>
    </div>
  </template>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { ref } from 'vue'
import { electronAPI } from '@/utils/envUtil'
import { useCommandStore } from '@/stores/commandStore'

type RestoreNodesProgress = {
  total: number
  index?: number
  exitCode?: number
}

const electron = electronAPI()

const state = ref<'running' | 'complete' | null>(null)
const commandFailed = ref<boolean>(false)

const current = ref<number>(0)
const failed = ref<number>(0)
const installed = ref<number>(0)
const total = ref<number>(0)

const restoreCustomNodes = async () => {
  if (state.value !== null) return

  // Reset state
  commandFailed.value = false
  current.value = 0
  installed.value = 0
  failed.value = 0
  total.value = 0

  // Call desktop
  if (
    // TODO: Remove when API used
    electron &&
    'restoreCustomNodes' in electron &&
    'onRestoreCustomNodes' in electron &&
    typeof electron.restoreCustomNodes === 'function' &&
    typeof electron.onRestoreCustomNodes === 'function'
  ) {
    state.value = 'running'
    await electron.onRestoreCustomNodes(updateRestoreNodesProgress)
    const started = await electron.restoreCustomNodes()

    if (started) return
  }
  commandFailed.value = true
  state.value = 'complete'
}

const updateRestoreNodesProgress = ({
  total: totalItems,
  index,
  exitCode
}: RestoreNodesProgress) => {
  total.value = totalItems

  if (index !== undefined) current.value = index + 1

  // Installation in progress
  if (exitCode === undefined) return

  if (exitCode === 0) {
    // Success
    installed.value++
  } else {
    // Fail
    failed.value++
  }

  // Reset state if finished
  if (index === totalItems - 1) state.value = 'complete'
}

const openLogs = () => {
  console.warn('Doing')
  useCommandStore().execute('Comfy-Desktop.Folders.OpenLogsFolder')
}
</script>
