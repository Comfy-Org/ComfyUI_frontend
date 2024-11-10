<template>
  <div
    class="font-sans flex flex-col justify-center items-center h-screen m-0 text-neutral-300 bg-neutral-900"
  >
    <FirstTimeSetup
      v-if="showSetup"
      :initial-path="defaultInstallLocation"
      @complete="showSetup = false"
    />
    <div v-else>
      <h2 class="text-2xl font-bold">{{ ProgressMessages[status] }}</h2>
      <LogTerminal :fetch-logs="fetchLogs" :fetch-interval="500" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import FirstTimeSetup from './screens/FirstTimeSetup.vue'
import LogTerminal from '@/components/common/LogTerminal.vue'
import {
  ProgressStatus,
  ProgressMessages
} from '@comfyorg/comfyui-electron-types'
import { electronAPI as getElectronAPI } from '@/utils/envUtil'

const electronAPI = getElectronAPI()

const showSetup = ref<boolean | null>(null)
const status = ref<ProgressStatus>(ProgressStatus.INITIAL_STATE)
const logs = ref<string[]>([])
const defaultInstallLocation = ref('')

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
  electronAPI.sendReady()

  electronAPI.onShowSelectDirectory(() => {
    showSetup.value = true
  })

  electronAPI.onFirstTimeSetupComplete(() => {
    showSetup.value = false
  })

  electronAPI.onProgressUpdate(updateProgress)
  electronAPI.onLogMessage((message: string) => {
    addLogMessage(message)
  })
})
</script>
