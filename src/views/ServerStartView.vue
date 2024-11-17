<template>
  <div
    class="font-sans flex flex-col justify-center items-center h-screen m-0 text-neutral-300 bg-neutral-900 dark-theme pointer-events-auto"
  >
    <h2 class="text-2xl font-bold">{{ ProgressMessages[status] }}</h2>
    <LogTerminal :fetch-logs="fetchLogs" :fetch-interval="500" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import LogTerminal from '@/components/common/LogTerminal.vue'
import {
  ProgressStatus,
  ProgressMessages
} from '@comfyorg/comfyui-electron-types'
import { electronAPI } from '@/utils/envUtil'

const electron = electronAPI()

const status = ref<ProgressStatus>(ProgressStatus.INITIAL_STATE)
const logs = ref<string[]>([])

const updateProgress = ({ status: newStatus }: { status: ProgressStatus }) => {
  status.value = newStatus
  logs.value = [] // Clear logs when status changes
}

const addLogMessage = (message: string) => {
  logs.value = [...logs.value, message]
}

const fetchLogs = async () => {
  return logs.value.join('\n')
}

onMounted(() => {
  electron.sendReady()
  electron.onProgressUpdate(updateProgress)
  electron.onLogMessage((message: string) => {
    addLogMessage(message)
  })
})
</script>
